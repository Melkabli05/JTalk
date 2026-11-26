import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  PLATFORM_ID,
  Service,
  signal,
} from '@angular/core';
import { IdentityStore } from '../../../core/auth/identity';
import { errorMessage } from '../../../core/http/http-error.interceptor';
import { BrowserStorage } from '../../../core/services/browser-storage';
import { ACTIVE_ROOM_STORAGE_KEY } from '../../../shared/constants/storage-keys.constants';
import type {
  RoomJoinSnapshot,
  UpdateVoiceRoomPayload,
} from '../../../shared/models/voice-room.model';
import { RoomsApi } from '../../rooms/data-access/rooms-api';
import { LiveKitAudioEngine, type NetworkModeChange } from '../data-access/livekit-audio-engine';
import { VoiceRoomApi } from '../data-access/voice-room-api';
import { RoomChatStore } from './room-chat-store';
import { type ActionFeedback, RoomStageStore } from './room-stage-store';

export type { ActionFeedback };

export type RoomConnectionState =
  | { readonly status: 'idle' }
  | { readonly status: 'joining'; readonly roomId: string }
  | { readonly status: 'connected'; readonly roomId: string }
  | { readonly status: 'error'; readonly message: string };

@Service()
export class LiveRoomStore {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly storage = inject(BrowserStorage);
  private readonly roomsApi = inject(RoomsApi);
  private readonly voiceRoomApi = inject(VoiceRoomApi);
  private readonly identity = inject(IdentityStore);

  readonly stage = inject(RoomStageStore);
  readonly chat = inject(RoomChatStore);
  readonly audio = inject(LiveKitAudioEngine);

  private unbindAudioEvents: (() => void) | null = null;
  private networkModeQueue: NetworkModeChange[] = [];
  private flushingNetworkMode = false;
  private signingOut = false;
  private transitionQueue: Promise<void> = Promise.resolve();
  private readonly snapshotLoading = signal(false);

  private readonly rememberedRoom = linkedSignal<boolean, string | null>({
    source: () => this.identity.isAuthenticated(),
    computation: (signedIn, previous) =>
      signedIn ? (previous?.value ?? this.readStoredActiveRoomId()) : null,
  });
  readonly resumeRoomId = this.rememberedRoom.asReadonly();

  private readonly focusStageTickState = signal(0);
  readonly focusStageTick = this.focusStageTickState.asReadonly();

  private readonly connectionStateSignal = signal<RoomConnectionState>({ status: 'idle' });
  readonly connectionState = this.connectionStateSignal.asReadonly();

  readonly room = this.stage.room;
  readonly roomId = this.stage.roomId;
  readonly practiseLangLabel = this.stage.practiseLangLabel;
  readonly roomLoading = computed(() => this.connectionStateSignal().status === 'joining');
  readonly roomError = computed<string | null>(() => {
    const state = this.connectionStateSignal();
    return state.status === 'error' ? state.message : null;
  });
  readonly muted = computed(() => !this.audio.micOn());
  readonly effectiveRoomTopic = computed(
    () => this.chat.pinnedTopic() || this.stage.room()?.topic || '',
  );
  readonly messagesLoading = computed(() => this.snapshotLoading() || this.chat.loading());

  constructor() {
    this.destroyRef.onDestroy(() => this.teardownAudioEvents());
  }

  rememberRoom(roomId: string | null): void {
    this.rememberedRoom.set(roomId);
    if (roomId) {
      this.storage.setString('session', ACTIVE_ROOM_STORAGE_KEY, roomId);
    } else {
      this.storage.remove('session', ACTIVE_ROOM_STORAGE_KEY);
    }
  }

  triggerStageFocus(): void {
    this.focusStageTickState.update((n): number => n + 1);
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
      this.identity.signOut();
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
        this.chat.setChatMuted(session.isChatMuted);
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
      if (connected) {
        this.connectionStateSignal.set({ status: 'connected', roomId: id });
        if (!snapshot) void this.resyncRoomSnapshot(id);
      }
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
      this.rememberRoom(null);
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
        this.connectionStateSignal.set({
          status: 'error',
          message: left.message ?? 'Could not leave the previous room.',
        });
        return false;
      }
    }

    this.connectionStateSignal.set({ status: 'joining', roomId });
    this.teardownAudioEvents();
    const generation = this.stage.bumpGeneration();

    try {
      const session = await this.voiceRoomApi.join(roomId);
      if (generation !== this.stage.generation()) return false;
      this.stage.applySessionStart(session);
      if (session.isChatMuted !== undefined) this.chat.setChatMuted(session.isChatMuted);
      if (session.snapshot) this.applyJoinSnapshot(session.snapshot);
      this.rememberRoom(session.room.id);
      this.bindRealtimeStreams(session.room.id);
      if (!session.snapshot) void this.resyncRoomSnapshot(session.room.id);

      const connected = await this.audio.connect(session);
      if (generation !== this.stage.generation()) return false;
      if (connected) {
        this.connectionStateSignal.set({ status: 'connected', roomId: session.room.id });
      } else {
        this.connectionStateSignal.set({
          status: 'error',
          message: 'Connected to room, but LiveKit audio could not start. Tap Retry audio.',
        });
      }
      return true;
    } catch (err) {
      if (generation === this.stage.generation()) {
        this.teardownAudioEvents();
        this.resetAll();
        this.rememberRoom(null);
        this.connectionStateSignal.set({
          status: 'error',
          message: errorMessage(err, 'Could not join this voice room.'),
        });
      }
      return false;
    } finally {
      if (
        generation === this.stage.generation() &&
        this.connectionStateSignal().status === 'joining'
      ) {
        this.connectionStateSignal.set({ status: 'idle' });
      }
    }
  }

  private async exitRoom(): Promise<ActionFeedback> {
    const id = this.roomId();
    this.teardownAudioEvents();
    const disconnected = this.audio.disconnect();
    this.resetAll();
    this.rememberRoom(null);
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

  private async resyncRoomSnapshot(roomId: string): Promise<void> {
    const roomBefore = this.room();
    if (roomBefore?.id !== roomId) return;
    const generation = this.stage.generation();
    const stageBefore = this.stage.stage();
    const audienceBefore = this.stage.audienceIds();
    const chatRevisionBefore = this.chat.revision();

    this.chat.setChatError(false);
    this.snapshotLoading.set(true);
    try {
      const res = await this.voiceRoomApi.getSnapshot(roomId);
      if (generation !== this.stage.generation()) return;
      this.stage.applyResyncSnapshot(res, {
        room: roomBefore,
        stage: stageBefore,
        audience: audienceBefore,
      });
      if (this.chat.revision() === chatRevisionBefore) {
        this.chat.applyChatState(res.snapshot.chat);
      } else {
        void this.chat.reloadMessages();
      }
    } catch {
      if (generation === this.stage.generation()) this.chat.setChatError(true);
    } finally {
      if (generation === this.stage.generation()) this.snapshotLoading.set(false);
    }
  }

  private bindRealtimeStreams(roomId: string): void {
    this.teardownAudioEvents();
    const generation = this.stage.generation();
    this.unbindAudioEvents = this.audio.onEvents({
      onRoomEnded: (message) => {
        this.teardownAudioEvents();
        this.resetAll();
        this.rememberRoom(null);
        this.connectionStateSignal.set({ status: 'error', message });
      },
      onReconnected: () => void this.resyncRoomSnapshot(roomId),
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
      while (generation === this.stage.generation()) {
        const next = this.networkModeQueue.shift();
        if (!next) break;
        const { mode, primarySids, secondarySids } = next;
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
    this.snapshotLoading.set(false);
    this.connectionStateSignal.set({ status: 'idle' });
    this.stage.reset();
    this.chat.reset();
  }

  private readStoredActiveRoomId(): string | null {
    return this.storage.getString('session', ACTIVE_ROOM_STORAGE_KEY);
  }
}
