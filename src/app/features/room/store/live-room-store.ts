import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  PLATFORM_ID,
  Service,
  signal,
} from '@angular/core';
import { finalize } from 'rxjs';
import { IdentityStore } from '../../../core/auth/identity';
import { ApiError, errorMessage } from '../../../core/http/http-error.interceptor';
import type {
  RoomJoinSnapshot,
  UpdateVoiceRoomPayload,
} from '../../../shared/models/voice-room.model';
import { RoomsApi } from '../../rooms/data-access/rooms-api';
import { LiveKitAudioEngine } from '../data-access/livekit-audio-engine';
import { VoiceRoomApi } from '../data-access/voice-room-api';
import type { ActionFeedback, RoomConnectionState } from '../models/live-room.model';
import type { NetworkModeChange } from '../models/livekit.model';
import { RoomChatStore } from './room-chat-store';
import { RoomStageStore } from './room-stage-store';

@Service()
export class LiveRoomStore {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
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
  private endingRoom = false;
  private transitioning = false;
  private readonly pendingTransitions: (() => void)[] = [];
  private readonly snapshotLoading = signal(false);
  private checkedPresenceForUserId: string | null = null;
  private afkTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly rememberedRoom = linkedSignal<boolean, string | null>({
    source: () => this.identity.isAuthenticated(),
    computation: (signedIn, previous) => (signedIn ? (previous?.value ?? null) : null),
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
    return state.status === 'error' || state.status === 'ended' || state.status === 'kicked'
      ? state.message
      : null;
  });
  readonly muted = computed(() => !this.audio.micOn());
  readonly effectiveRoomTopic = computed(
    () => this.chat.pinnedTopic() || this.stage.room()?.topic || '',
  );
  readonly messagesLoading = computed(() => this.snapshotLoading() || this.chat.loading());

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.teardownAudioEvents();
      this.clearAfkTimer();
    });

    if (isPlatformBrowser(this.platformId) && typeof document !== 'undefined') {
      const onVisibilityChange = (): void => this.evaluateBackgroundAfkGuard();
      document.addEventListener('visibilitychange', onVisibilityChange);
      this.destroyRef.onDestroy(() =>
        document.removeEventListener('visibilitychange', onVisibilityChange),
      );

      effect(() => {
        // Re-evaluate AFK timer whenever mic state or stage membership changes while hidden.
        this.audio.micOn();
        this.stage.isCurrentUserOnStage();
        this.stage.roomId();
        this.evaluateBackgroundAfkGuard();
      });
    }

    effect((onCleanup) => {
      const signedIn = this.identity.isAuthenticated();
      const userId = this.identity.me()?.id ?? null;
      if (!signedIn || !userId) {
        this.checkedPresenceForUserId = null;
        return;
      }
      if (!isPlatformBrowser(this.platformId) || this.checkedPresenceForUserId === userId) {
        return;
      }
      this.checkedPresenceForUserId = userId;
      if (this.stage.roomId()) return;
      const sub = this.roomsApi.getUserPresence(userId).subscribe({
        next: (presence) => {
          if (!this.stage.roomId()) {
            this.rememberRoom(presence.live ? presence.roomId : null);
          }
        },
        error: () => {
          // Best-effort startup recovery; ignore transient network errors.
        },
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  rememberRoom(roomId: string | null): void {
    this.rememberedRoom.set(roomId);
  }

  triggerStageFocus(): void {
    this.focusStageTickState.update((n): number => n + 1);
  }

  enterRoom(roomId: string, onDone?: (entered: boolean) => void): void {
    this.runSerialized((release) => {
      this.joinRoom(roomId, (entered) => {
        release();
        onDone?.(entered);
      });
    });
  }

  leaveRoom(onDone?: (res: ActionFeedback) => void): void {
    this.runSerialized((release) => {
      this.exitRoom((res) => {
        release();
        onDone?.(res);
      });
    });
  }

  signOut(): void {
    if (this.signingOut) return;
    this.signingOut = true;
    this.leaveRoom(() => {
      this.signingOut = false;
      this.identity.signOut();
    });
  }

  reconnectAudio(onDone?: (res: ActionFeedback) => void): void {
    const id = this.roomId();
    if (!id) {
      onDone?.({ ok: false, message: 'No active room.' });
      return;
    }
    const generation = this.stage.generation();
    const chatRevision = this.chat.revision();
    const stageBefore = this.stage.stage();
    const roomBefore = this.room();
    this.voiceRoomApi.join(id).subscribe({
      next: (session) => {
        if (generation !== this.stage.generation()) {
          onDone?.({ ok: false });
          return;
        }
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
        this.audio.connectSession(session, (connected) => {
          if (generation !== this.stage.generation()) {
            onDone?.({ ok: false });
            return;
          }
          if (connected && !snapshot) this.resyncRoomSnapshot(id);
          onDone?.(
            connected ? { ok: true } : { ok: false, message: 'Could not reconnect audio stream.' },
          );
        });
      },
      error: (err: unknown) => {
        onDone?.({ ok: false, message: errorMessage(err, 'Could not reconnect audio.') });
      },
    });
  }

  endRoom(onDone?: (res: ActionFeedback) => void): void {
    const id = this.roomId();
    if (!id) {
      onDone?.({ ok: false, message: 'No active room.' });
      return;
    }
    if (this.endingRoom) return;
    this.endingRoom = true;
    const generation = this.stage.generation();
    this.roomsApi.closeRoom(id).subscribe({
      next: () => {
        this.endingRoom = false;
        if (generation !== this.stage.generation()) {
          onDone?.({ ok: true });
          return;
        }
        this.teardownAudioEvents();
        this.resetAll();
        this.rememberRoom(null);
        this.audio.disconnectSession(() => onDone?.({ ok: true }));
      },
      error: (err: unknown) => {
        this.endingRoom = false;
        onDone?.({ ok: false, message: errorMessage(err, 'Could not end the room.') });
      },
    });
  }

  updateRoom(patch: UpdateVoiceRoomPayload, onDone?: (res: ActionFeedback) => void): void {
    const id = this.roomId();
    if (!id) {
      onDone?.({ ok: false, message: 'No active room.' });
      return;
    }
    const generation = this.stage.generation();
    this.roomsApi.updateRoom(id, patch).subscribe({
      next: (updated) => {
        if (generation === this.stage.generation()) this.stage.patchRoom(updated);
        onDone?.({ ok: true });
      },
      error: (err: unknown) => {
        onDone?.({ ok: false, message: errorMessage(err, 'Could not update room.') });
      },
    });
  }

  toggleSelfMic(onDone?: (res: ActionFeedback) => void): void {
    if (
      this.audio.isMutedByHost() ||
      (this.stage.isCurrentUserOnStage() &&
        this.audio.status() === 'connected' &&
        !this.audio.canPublish())
    ) {
      onDone?.({ ok: false, message: 'The host muted your microphone.' });
      return;
    }
    if (!this.audio.canPublish()) {
      onDone?.({ ok: false, message: 'Join the stage to use your microphone.' });
      return;
    }
    this.audio.toggleMic((ok) => {
      onDone?.(
        ok ? { ok: true } : { ok: false, message: this.audio.micError() ?? 'Microphone error.' },
      );
    });
  }

  private runSerialized(work: (release: () => void) => void): void {
    const start = (): void => {
      this.transitioning = true;
      let released = false;
      work(() => {
        if (released) return;
        released = true;
        this.transitioning = false;
        this.pendingTransitions.shift()?.();
      });
    };
    if (this.transitioning) {
      this.pendingTransitions.push(start);
    } else {
      start();
    }
  }

  private joinRoom(roomId: string, onDone: (entered: boolean) => void): void {
    if (!isPlatformBrowser(this.platformId) || !roomId) {
      onDone(false);
      return;
    }
    if (this.roomId() === roomId && this.audio.status() === 'connected') {
      onDone(true);
      return;
    }

    const proceedJoin = (): void => {
      this.connectionStateSignal.set({ status: 'joining', roomId });
      this.teardownAudioEvents();
      const generation = this.stage.bumpGeneration();

      this.voiceRoomApi.join(roomId).subscribe({
        next: (session) => {
          if (generation !== this.stage.generation()) {
            onDone(false);
            return;
          }
          this.stage.applySessionStart(session);
          if (session.isChatMuted !== undefined) this.chat.setChatMuted(session.isChatMuted);
          if (session.snapshot) this.applyJoinSnapshot(session.snapshot);
          this.rememberRoom(session.room.id);
          this.bindRealtimeStreams(session.room.id);
          if (!session.snapshot) this.resyncRoomSnapshot(session.room.id);

          this.audio.connectSession(session, (connected) => {
            if (generation !== this.stage.generation()) {
              onDone(false);
              return;
            }
            if (connected) {
              this.connectionStateSignal.set({ status: 'connected', roomId: session.room.id });
            } else {
              this.connectionStateSignal.set({
                status: 'error',
                message: 'Connected to room, but LiveKit audio could not start. Tap Retry audio.',
              });
            }
            onDone(true);
          });
        },
        error: (err: unknown) => {
          if (generation === this.stage.generation()) {
            this.teardownAudioEvents();
            this.resetAll();
            this.rememberRoom(null);
            const missing =
              err instanceof ApiError &&
              (err.status === 404 ||
                err.type === 'urn:jtalk:live-communication:problem:voice-room-not-found');
            this.connectionStateSignal.set({
              status: missing ? 'ended' : 'error',
              message: errorMessage(
                err,
                missing ? 'This voice room no longer exists.' : 'Could not join this voice room.',
              ),
            });
          }
          onDone(false);
        },
      });
    };

    if (this.roomId() && this.roomId() !== roomId) {
      this.exitRoom((left) => {
        if (!left.ok) {
          this.connectionStateSignal.set({
            status: 'error',
            message: left.message ?? 'Could not leave the previous room.',
          });
          onDone(false);
          return;
        }
        proceedJoin();
      });
      return;
    }

    proceedJoin();
  }

  private exitRoom(onDone: (res: ActionFeedback) => void): void {
    const id = this.roomId();
    this.teardownAudioEvents();
    this.resetAll();
    this.rememberRoom(null);
    this.audio.disconnectSession(() => {
      if (!id) {
        onDone({ ok: true });
        return;
      }
      this.voiceRoomApi.leave(id).subscribe({
        next: () => onDone({ ok: true }),
        error: (err: unknown) =>
          onDone({
            ok: false,
            message: errorMessage(
              err,
              'Audio disconnected. The service could not confirm your departure.',
            ),
          }),
      });
    });
  }

  private applyJoinSnapshot(snapshot: RoomJoinSnapshot): void {
    this.stage.applyJoinSnapshot(snapshot);
    this.chat.applyChatState(snapshot.chat);
  }

  private resyncRoomSnapshot(roomId: string): void {
    const roomBefore = this.room();
    if (roomBefore?.id !== roomId) return;
    const generation = this.stage.generation();
    const stageBefore = this.stage.stage();
    const audienceBefore = this.stage.audienceIds();
    const chatRevisionBefore = this.chat.revision();

    this.chat.setChatError(false);
    this.snapshotLoading.set(true);
    this.voiceRoomApi
      .getSnapshot(roomId)
      .pipe(
        finalize(() => {
          if (generation === this.stage.generation()) this.snapshotLoading.set(false);
        }),
      )
      .subscribe({
        next: (res) => {
          if (generation !== this.stage.generation()) return;
          this.stage.applyResyncSnapshot(res, {
            room: roomBefore,
            stage: stageBefore,
            audience: audienceBefore,
          });
          if (this.chat.revision() === chatRevisionBefore) {
            this.chat.applyChatState(res.snapshot.chat);
          } else {
            this.chat.reloadMessages();
          }
        },
        error: () => {
          if (generation === this.stage.generation()) this.chat.setChatError(true);
        },
      });
  }

  private bindRealtimeStreams(roomId: string): void {
    this.teardownAudioEvents();
    const generation = this.stage.generation();
    this.unbindAudioEvents = this.audio.onEvents({
      onRoomEnded: (message) => {
        this.teardownAudioEvents();
        this.resetAll();
        this.rememberRoom(null);
        const status = message.toLowerCase().includes('removed') ? 'kicked' : 'ended';
        this.connectionStateSignal.set({ status, message });
      },
      onReconnected: () => this.resyncRoomSnapshot(roomId),
      onRoomEvent: (event) => this.stage.applyRoomRealtimeEvent(event),
      onChatEvent: (event) => this.chat.applyChatRealtimeEvent(event),
      onNetworkModeChange: (change) => {
        if (
          change.mode === 'LOW_BANDWIDTH' &&
          change.primarySids.length + change.secondarySids.length === 0
        ) {
          return;
        }
        this.networkModeQueue.push(change);
        this.flushNetworkModeQueue(roomId, generation);
      },
    });
  }

  private flushNetworkModeQueue(roomId: string, generation: number): void {
    if (this.flushingNetworkMode || generation !== this.stage.generation()) return;
    const next = this.networkModeQueue.shift();
    if (!next) return;
    this.flushingNetworkMode = true;
    const { mode, primarySids, secondarySids } = next;
    this.voiceRoomApi.updateNetworkMode(roomId, mode, secondarySids, primarySids).subscribe({
      next: () => {
        this.flushingNetworkMode = false;
        this.flushNetworkModeQueue(roomId, generation);
      },
      error: () => {
        // Best-effort network quality reporting; proceed to the next queued update.
        this.flushingNetworkMode = false;
        this.flushNetworkModeQueue(roomId, generation);
      },
    });
  }

  private teardownAudioEvents(): void {
    this.unbindAudioEvents?.();
    this.unbindAudioEvents = null;
    this.networkModeQueue = [];
  }

  stayLive(roomId: string): void {
    this.stage.dismissIdleWarning();
    this.voiceRoomApi.keepalive(roomId).subscribe({
      error: () => {
        // Best-effort keepalive; room closure or network errors are handled by normal room events.
      },
    });
  }

  private evaluateBackgroundAfkGuard(): void {
    const roomId = this.stage.roomId();
    const shouldWatch =
      typeof document !== 'undefined' &&
      document.hidden &&
      roomId !== null &&
      this.stage.isCurrentUserOnStage() &&
      !this.audio.micOn();

    if (!shouldWatch) {
      this.clearAfkTimer();
      return;
    }
    if (this.afkTimer !== null) return;

    this.afkTimer = setTimeout(() => {
      this.afkTimer = null;
      const activeRoomId = this.stage.roomId();
      if (!activeRoomId || !this.stage.isCurrentUserOnStage() || this.audio.micOn()) return;
      if (this.stage.isHost()) {
        this.stage.applyRoomRealtimeEvent({ type: 'ROOM_IDLE_WARNING', roomId: activeRoomId });
      } else {
        this.leaveStage(activeRoomId);
      }
    }, 300_000);
  }

  private clearAfkTimer(): void {
    if (this.afkTimer !== null) {
      clearTimeout(this.afkTimer);
      this.afkTimer = null;
    }
  }

  private resetAll(): void {
    this.clearAfkTimer();
    this.endingRoom = false;
    this.snapshotLoading.set(false);
    this.connectionStateSignal.set({ status: 'idle' });
    this.stage.reset();
    this.chat.reset();
  }
}
