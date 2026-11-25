import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  PLATFORM_ID,
  Service,
  signal,
  untracked,
} from '@angular/core';
import { IdentityStore } from '../../../core/auth/identity';
import { errorMessage } from '../../../core/http/http-error.interceptor';
import { AppState } from '../../../core/state/app-state';
import {
  RoomJoinSnapshot,
  StageDto,
  UpdateVoiceRoomPayload,
  VoiceRoomDto,
} from '../../../shared/models/voice-room.model';
import { RoomsApi } from '../../rooms/data-access/rooms-api';
import { LiveKitAudioEngine, NetworkModeChange } from '../data-access/livekit-audio-engine';
import { RoomResourceTrigger, VoiceRoomApi } from '../data-access/voice-room-api';
import { RoomChatStore } from './room-chat-store';
import { ActionFeedback, RoomStageStore } from './room-stage-store';

export type { ActionFeedback };

interface SnapshotLoadRequest extends RoomResourceTrigger {
  readonly generation: number;
  readonly roomBefore: VoiceRoomDto;
  readonly stageBefore: StageDto;
  readonly audienceBefore: readonly string[];
  readonly chatRevisionBefore: number;
}

@Service()
export class LiveRoomStore {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly roomsApi = inject(RoomsApi);
  private readonly voiceRoomApi = inject(VoiceRoomApi);
  private readonly identity = inject(IdentityStore);
  private readonly appState = inject(AppState);

  readonly stage = inject(RoomStageStore);
  readonly chat = inject(RoomChatStore);
  readonly audio = inject(LiveKitAudioEngine);

  private unbindAudioEvents: (() => void) | null = null;
  private networkModeQueue: NetworkModeChange[] = [];
  private flushingNetworkMode = false;
  private snapshotSeq = 0;
  private signingOut = false;
  private transitionQueue: Promise<void> = Promise.resolve();

  private readonly snapshotRequest = signal<SnapshotLoadRequest | null>(null);
  private readonly snapshotRes = this.voiceRoomApi.snapshotResource(
    () => this.snapshotRequest() ?? undefined,
  );

  // Shell-facing session references & genuine cross-store aggregations
  readonly room = this.stage.room;
  readonly roomId = this.stage.roomId;
  readonly practiseLangLabel = this.stage.practiseLangLabel;
  readonly roomLoading = signal(false);
  readonly roomError = signal<string | null>(null);
  readonly muted = computed(() => !this.audio.micOn());
  readonly effectiveRoomTopic = computed(
    () => this.chat.pinnedTopic() || this.stage.room()?.topic || '',
  );
  readonly messagesLoading = computed(
    () => this.snapshotRes.isLoading() || this.chat.loading(),
  );

  constructor() {
    effect(() => {
      const req = this.snapshotRequest();
      if (!req) return;
      const status = this.snapshotRes.status();
      if (status === 'resolved' && this.snapshotRes.hasValue()) {
        const res = this.snapshotRes.value();
        untracked(() => {
          this.snapshotRequest.set(null);
          if (req.generation !== this.stage.generation()) return;
          this.stage.applyResyncSnapshot(res, {
            room: req.roomBefore,
            stage: req.stageBefore,
            audience: req.audienceBefore,
          });
          if (this.chat.revision() === req.chatRevisionBefore) {
            this.chat.applyChatState(res.snapshot.chat);
          } else {
            this.chat.reloadMessages();
          }
        });
      } else if (status === 'error') {
        untracked(() => {
          this.snapshotRequest.set(null);
          if (req.generation === this.stage.generation()) {
            this.chat.chatError.set(true);
          }
        });
      }
    });

    this.destroyRef.onDestroy(() => this.teardownAudioEvents());
  }

  enterRoom(roomId: string): Promise<boolean> {
    return this.runSerialized(() => this.joinRoom(roomId));
  }

  leaveRoom(): Promise<ActionFeedback> {
    return this.runSerialized(() => this.exitRoom());
  }

  async signOut(): Promise<void> {
    if (this.signingOut) return;
    this.signingOut = true;
    try {
      await this.leaveRoom();
      await this.identity.signOut();
    } finally {
      this.signingOut = false;
    }
  }

  async reconnectAudio(): Promise<ActionFeedback> {
    const id = this.roomId();
    if (!id) return { ok: false, message: 'No active room.' };
    const generation = this.stage.generation();
    const chatRevision = this.chat.revision();
    const stageBefore = this.stage.stage();
    const roomBefore = this.room();
    try {
      const session = await this.voiceRoomApi.join(id);
      if (generation !== this.stage.generation()) return { ok: false };
      if (session.isChatMuted !== undefined && chatRevision === this.chat.revision()) {
        this.chat.isChatMuted.set(session.isChatMuted);
      }
      const snapshot =
        chatRevision === this.chat.revision() &&
        this.stage.stage() === stageBefore &&
        this.room() === roomBefore
          ? session.snapshot
          : undefined;
      if (snapshot) {
        this.stage.applySessionStart(session);
        this.applyJoinSnapshot(snapshot);
      }
      const connected = await this.audio.connect(session);
      if (generation !== this.stage.generation()) return { ok: false };
      if (connected && !snapshot) this.resyncRoomSnapshot(id);
      return connected
        ? { ok: true }
        : { ok: false, message: 'Could not reconnect audio stream.' };
    } catch (err) {
      return { ok: false, message: errorMessage(err, 'Could not reconnect audio.') };
    }
  }

  async endRoom(): Promise<ActionFeedback> {
    const id = this.roomId();
    if (!id) return { ok: false, message: 'No active room.' };
    const generation = this.stage.generation();
    try {
      await this.roomsApi.closeRoom(id);
      if (generation !== this.stage.generation()) return { ok: true };
      this.teardownAudioEvents();
      const disconnected = this.audio.disconnect();
      this.resetAll();
      this.appState.rememberRoom(null);
      await disconnected;
      return { ok: true };
    } catch (err) {
      return { ok: false, message: errorMessage(err, 'Could not end the room.') };
    }
  }

  async updateRoom(patch: UpdateVoiceRoomPayload): Promise<ActionFeedback> {
    const id = this.roomId();
    if (!id) return { ok: false, message: 'No active room.' };
    const generation = this.stage.generation();
    try {
      const updated = await this.roomsApi.updateRoom(id, patch);
      if (generation === this.stage.generation()) this.stage.patchRoom(updated);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: errorMessage(err, 'Could not update room.') };
    }
  }

  async toggleSelfMic(): Promise<ActionFeedback> {
    if (!this.audio.canPublish()) {
      return { ok: false, message: 'Join the stage to use your microphone.' };
    }
    const ok = await this.audio.toggleMicrophone();
    return ok ? { ok: true } : { ok: false, message: this.audio.micError() ?? 'Microphone error.' };
  }

  private async runSerialized<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.transitionQueue;
    let release!: () => void;
    this.transitionQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }

  private async joinRoom(roomId: string): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId) || !roomId) return false;
    if (this.roomId() === roomId && this.audio.status() === 'connected') return true;

    if (this.roomId() && this.roomId() !== roomId) {
      const left = await this.exitRoom();
      if (!left.ok) {
        this.roomError.set(left.message ?? 'Could not leave the previous room.');
        return false;
      }
    }

    this.roomLoading.set(true);
    this.roomError.set(null);
    this.teardownAudioEvents();
    const generation = this.stage.bumpGeneration();

    try {
      const session = await this.voiceRoomApi.join(roomId);
      if (generation !== this.stage.generation()) return false;
      this.stage.applySessionStart(session);
      if (session.isChatMuted !== undefined) this.chat.isChatMuted.set(session.isChatMuted);
      if (session.snapshot) this.applyJoinSnapshot(session.snapshot);
      this.appState.rememberRoom(session.room.id);
      this.bindRealtimeStreams(session.room.id);
      if (!session.snapshot) this.resyncRoomSnapshot(session.room.id);

      const connected = await this.audio.connect(session);
      if (generation !== this.stage.generation()) return false;
      if (!connected) {
        this.roomError.set(
          'Connected to room, but LiveKit audio could not start. Tap Retry audio.',
        );
      }
      return true;
    } catch (err) {
      if (generation === this.stage.generation()) {
        this.teardownAudioEvents();
        this.resetAll();
        this.appState.rememberRoom(null);
        this.roomError.set(errorMessage(err, 'Could not join this voice room.'));
      }
      return false;
    } finally {
      this.roomLoading.set(false);
    }
  }

  private async exitRoom(): Promise<ActionFeedback> {
    const id = this.roomId();
    this.teardownAudioEvents();
    const disconnected = this.audio.disconnect();
    this.resetAll();
    this.appState.rememberRoom(null);
    await disconnected;
    if (!id) return { ok: true };
    try {
      await this.voiceRoomApi.leave(id);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message: errorMessage(
          err,
          'Audio disconnected. The service could not confirm your departure.',
        ),
      };
    }
  }

  private applyJoinSnapshot(snapshot: RoomJoinSnapshot): void {
    this.stage.applyJoinSnapshot(snapshot);
    this.chat.applyChatState(snapshot.chat);
  }

  private resyncRoomSnapshot(roomId: string): void {
    const currentRoom = this.room();
    if (currentRoom?.id !== roomId) return;
    this.chat.chatError.set(false);
    this.snapshotRequest.set({
      roomId,
      seq: ++this.snapshotSeq,
      generation: this.stage.generation(),
      roomBefore: currentRoom,
      stageBefore: this.stage.stage(),
      audienceBefore: this.stage.audienceIds(),
      chatRevisionBefore: this.chat.revision(),
    });
  }

  private bindRealtimeStreams(roomId: string): void {
    this.teardownAudioEvents();
    const generation = this.stage.generation();
    this.unbindAudioEvents = this.audio.onEvents({
      onRoomEnded: (message) => {
        this.teardownAudioEvents();
        this.resetAll();
        this.appState.rememberRoom(null);
        this.roomError.set(message);
      },
      onReconnected: () => this.resyncRoomSnapshot(roomId),
      onRoomEvent: (event) => this.stage.applyRoomRealtimeEvent(event),
      onChatEvent: (event) => this.chat.applyChatRealtimeEvent(event),
      onNetworkModeChange: (change) => {
        if (change.mode === 'LOW_BANDWIDTH' && change.primarySids.length + change.secondarySids.length === 0) {
          return;
        }
        this.networkModeQueue.push(change);
        void this.flushNetworkModeQueue(roomId, generation);
      },
    });
  }

  private async flushNetworkModeQueue(roomId: string, generation: number): Promise<void> {
    if (this.flushingNetworkMode) return;
    this.flushingNetworkMode = true;
    try {
      while (this.networkModeQueue.length > 0 && generation === this.stage.generation()) {
        const { mode, primarySids, secondarySids } = this.networkModeQueue.shift()!;
        try {
          await this.voiceRoomApi.updateNetworkMode(roomId, mode, secondarySids, primarySids);
        } catch {
          // Best-effort network quality reporting; proceed to the next queued update.
        }
      }
    } finally {
      this.flushingNetworkMode = false;
    }
  }

  private teardownAudioEvents(): void {
    this.unbindAudioEvents?.();
    this.unbindAudioEvents = null;
    this.networkModeQueue = [];
  }

  private resetAll(): void {
    this.snapshotRequest.set(null);
    this.roomError.set(null);
    this.stage.reset();
    this.chat.reset();
  }
}
