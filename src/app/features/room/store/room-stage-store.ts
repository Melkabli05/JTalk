import {
  computed,
  DestroyRef,
  effect,
  inject,
  Service,
  signal,
  untracked,
} from '@angular/core';
import { IdentityStore } from '../../../core/auth/identity';
import { errorMessage } from '../../../core/http/http-error.interceptor';
import { AppState } from '../../../core/state/app-state';
import { languageNameFor } from '../../../core/utils/language-codes';
import { sanitizeAvatarUrl } from '../../../core/utils/safe-url';
import {
  BackendReaction,
  BackendRoomRole,
  emojiForReaction,
  ParticipantPreview,
  RoomJoinSnapshot,
  RoomRealtimeEvent,
  RoomSessionDto,
  RoomSnapshotDto,
  StageDto,
  VoiceRoomDto,
} from '../../../shared/models/voice-room.model';
import { avatarChipClassFor } from '../../../shared/utils/avatar-chip.utils';
import {
  AUDIENCE_INITIAL_LIMIT,
  DEFAULT_MAX_STAGE_SEATS,
} from '../constants/room.constants';
import { LiveKitAudioEngine } from '../data-access/livekit-audio-engine';
import { AudienceResourceTrigger, VoiceRoomApi } from '../data-access/voice-room-api';
import { RoomListener, RoomSpeaker } from '../models/live-room.model';

export interface ActionFeedback {
  readonly ok: boolean;
  readonly message?: string;
}

interface AudienceLoadRequest extends AudienceResourceTrigger {
  readonly generation: number;
  readonly onResult?: (feedback: ActionFeedback) => void;
}

@Service()
export class RoomStageStore {
  private readonly destroyRef = inject(DestroyRef);
  private readonly voiceRoomApi = inject(VoiceRoomApi);
  private readonly identity = inject(IdentityStore);
  private readonly appState = inject(AppState);
  private readonly audio = inject(LiveKitAudioEngine);

  private sessionGeneration = 0;
  private lastStageEventAt = 0;
  private audienceSeq = 0;
  private reactionTimeout: ReturnType<typeof setTimeout> | null = null;

  private readonly audienceRequest = signal<AudienceLoadRequest | null>(null);
  private readonly audienceRes = this.voiceRoomApi.audienceResource(
    () => this.audienceRequest() ?? undefined,
  );

  private readonly roomState = signal<VoiceRoomDto | null>(null);
  private readonly roleState = signal<BackendRoomRole>('LISTENER');
  private readonly roomProfilesState = signal<ReadonlyMap<string, ParticipantPreview>>(new Map());
  private readonly audienceCursor = signal<string | null>(null);
  private readonly audienceLimit = signal(AUDIENCE_INITIAL_LIMIT);

  readonly room = this.roomState.asReadonly();
  readonly roomId = computed(() => this.room()?.id ?? null);
  readonly currentUserId = computed(() => this.identity.userId() ?? '');
  readonly isHost = computed(() => this.roleState() === 'HOST');
  readonly isCurrentUserOnStage = computed(() => this.roleState() !== 'LISTENER');

  readonly stage = signal<StageDto>({ speakers: [], handRaiseQueue: [] });
  readonly audienceIds = signal<readonly string[]>([]);
  readonly audienceCount = signal(0);
  readonly hasMoreAudience = signal(false);
  readonly audienceLoading = this.audienceRes.isLoading;
  readonly stageReaction = signal<string | null>(null);
  readonly stageReactionKey = signal(0);

  readonly effectiveRoomTitle = computed(() => this.room()?.title || 'Live room');
  readonly effectiveMaxSeats = computed(
    () => this.room()?.maxStageSeats ?? DEFAULT_MAX_STAGE_SEATS,
  );
  readonly practiseLangLabel = computed(() => languageNameFor(this.room()?.targetLanguage));

  readonly hostName = computed(() => {
    const hostId = this.room()?.hostId;
    return hostId ? this.resolveDisplayName(hostId, 'Host') : this.appState.profile().name;
  });

  readonly speakers = computed<readonly RoomSpeaker[]>(() => {
    const hostId = this.room()?.hostId;
    const myId = this.currentUserId();
    const activeIds = new Set(this.audio.speakingIds());
    const mutedIds = new Set(this.audio.mutedIds());
    return this.stage().speakers.map((userId) => {
      const summary = this.profileFor(userId);
      const isYou = userId === myId;
      const name = this.resolveDisplayName(userId, 'Speaker');
      const muted = isYou ? !this.audio.micOn() : mutedIds.has(userId);
      return {
        id: userId,
        avatarUrl: sanitizeAvatarUrl(summary?.avatarUrl),
        name,
        initial: (name.trim()[0] ?? 'S').toUpperCase(),
        chipClass: avatarChipClassFor(userId),
        role: hostId === userId ? 'host' : 'speaker',
        isYou,
        muted,
        speaking: activeIds.has(userId) && !muted,
      };
    });
  });

  readonly listeners = computed<readonly RoomListener[]>(() => {
    const speakerSet = new Set(this.stage().speakers);
    const handQueue = new Set(this.stage().handRaiseQueue);
    return this.audienceIds()
      .filter((userId) => !speakerSet.has(userId))
      .map((userId) => {
        const name = this.resolveDisplayName(userId, 'Listener');
        return {
          id: userId,
          avatarUrl: sanitizeAvatarUrl(this.profileFor(userId)?.avatarUrl),
          name,
          initial: (name.trim()[0] ?? 'L').toUpperCase(),
          chipClass: avatarChipClassFor(userId),
          handRaised: handQueue.has(userId),
        };
      });
  });

  readonly pendingRequests = computed(() =>
    this.stage().handRaiseQueue.map((userId) => {
      const profile = this.profileFor(userId);
      const name = this.resolveDisplayName(userId, 'Listener');
      return {
        id: userId,
        avatarUrl: sanitizeAvatarUrl(profile?.avatarUrl),
        name,
        initial: (name.trim()[0] ?? 'L').toUpperCase(),
      };
    }),
  );

  readonly handRaised = computed(() => {
    const myId = this.currentUserId();
    return Boolean(myId && this.stage().handRaiseQueue.includes(myId));
  });

  readonly canClaimStageSeat = computed(
    () => !this.isCurrentUserOnStage() && this.stage().speakers.length < this.effectiveMaxSeats(),
  );

  constructor() {
    effect(() => {
      const req = this.audienceRequest();
      if (!req) return;
      const status = this.audienceRes.status();
      if (status === 'resolved' && this.audienceRes.hasValue()) {
        const page = this.audienceRes.value();
        untracked(() => {
          this.audienceRequest.set(null);
          if (req.generation !== this.sessionGeneration || this.audienceCursor() !== req.cursor) {
            req.onResult?.({ ok: true });
            return;
          }
          this.cachePreviews(page.audiencePreview);
          this.audienceIds.update((ids) => {
            const existing = new Set(ids);
            const additions = page.audiencePreview
              .map(({ userId }) => userId)
              .filter((userId) => !existing.has(userId));
            return [...ids, ...additions];
          });
          this.audienceCursor.set(page.nextCursor);
          this.hasMoreAudience.set(page.hasMoreAudience);
          this.audienceLimit.update((limit) => Math.max(limit, this.audienceIds().length));
          req.onResult?.({ ok: true });
        });
      } else if (status === 'error') {
        const err = this.audienceRes.error();
        untracked(() => {
          this.audienceRequest.set(null);
          req.onResult?.({
            ok: false,
            message: errorMessage(err, 'Could not load more listeners.'),
          });
        });
      }
    });

    this.destroyRef.onDestroy(() => this.clearReactionTimer());
  }

  generation(): number {
    return this.sessionGeneration;
  }

  bumpGeneration(): number {
    return ++this.sessionGeneration;
  }

  resolveDisplayName(userId: string, fallback: string): string {
    return (
      this.profileFor(userId)?.displayName ??
      (userId === this.currentUserId() ? this.appState.profile().name : fallback)
    );
  }

  resolveMissingUsers(ids: readonly string[]): void {
    const profiles = this.roomProfilesState();
    const missing = ids.filter((id) => !profiles.get(id)?.displayName);
    if (missing.length > 0) {
      void this.identity.resolveUsers(missing);
    }
  }

  async runRoomCommand(
    request: (roomId: string) => Promise<unknown>,
    failureMessage: string,
    onSuccess?: () => void,
  ): Promise<ActionFeedback> {
    const id = this.roomId();
    if (!id) return { ok: false, message: 'No active room.' };
    try {
      await request(id);
      onSuccess?.();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: errorMessage(err, failureMessage) };
    }
  }

  applySessionStart(session: RoomSessionDto): void {
    this.roleState.set(session.role);
    this.roomState.set(session.room);
    this.stage.set({ speakers: session.room.speakers, handRaiseQueue: [] });
  }

  applyJoinSnapshot(snapshot: RoomJoinSnapshot): void {
    this.cachePreviews([...snapshot.speakers, ...snapshot.audience.audiencePreview]);
    this.stage.set({
      speakers: snapshot.speakers.map(({ userId }) => userId),
      handRaiseQueue: snapshot.handRaiseQueue,
    });
    this.applySnapshotAudience(snapshot);
  }

  applyResyncSnapshot(
    res: RoomSnapshotDto,
    before: { room: VoiceRoomDto; stage: StageDto; audience: readonly string[] },
  ): void {
    if (this.room() === before.room && this.stage() === before.stage) {
      this.roleState.set(res.role);
    }
    if (this.room() === before.room) {
      this.roomState.set(res.room);
    }
    this.cachePreviews([...res.snapshot.speakers, ...res.snapshot.audience.audiencePreview]);
    if (this.stage() === before.stage) {
      this.stage.set({
        speakers: res.snapshot.speakers.map(({ userId }) => userId),
        handRaiseQueue: res.snapshot.handRaiseQueue,
      });
    }
    if (this.audienceIds() === before.audience) {
      this.applySnapshotAudience(res.snapshot);
    }
  }

  patchRoom(updated: Pick<VoiceRoomDto, 'title' | 'topic' | 'maxStageSeats'>): void {
    this.roomState.update(
      (room) =>
        room && {
          ...room,
          title: updated.title,
          topic: updated.topic,
          maxStageSeats: updated.maxStageSeats,
        },
    );
  }

  loadMoreAudience(onResult?: (feedback: ActionFeedback) => void): void {
    const roomId = this.roomId();
    const cursor = this.audienceCursor();
    if (!roomId || !this.hasMoreAudience() || this.audienceRequest() !== null) {
      onResult?.({ ok: true });
      return;
    }
    this.audienceRequest.set({
      roomId,
      cursor,
      seq: ++this.audienceSeq,
      generation: this.sessionGeneration,
      onResult,
    });
  }

  async claimStageSeat(): Promise<ActionFeedback> {
    const id = this.roomId();
    if (!id) return { ok: false, message: 'No active room.' };
    const generation = this.sessionGeneration;
    const stage = this.stage();
    try {
      const session = await this.voiceRoomApi.claimStageSeat(id);
      if (generation !== this.sessionGeneration) return { ok: false };
      if (this.stage() === stage) {
        this.roleState.set(session.role);
        this.stage.set({
          speakers: session.room.speakers,
          handRaiseQueue: stage.handRaiseQueue.filter((userId) => userId !== this.currentUserId()),
        });
      }
      if (!this.audio.canPublish()) {
        const connected = await this.audio.connect(session);
        if (generation !== this.sessionGeneration) return { ok: false };
        return connected
          ? { ok: true }
          : { ok: false, message: 'Stage seat claimed. Tap Retry audio to reconnect.' };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, message: errorMessage(err, 'Could not join the stage.') };
    }
  }

  leaveStage(): Promise<ActionFeedback> {
    const generation = this.sessionGeneration;
    return this.runRoomCommand(
      (id) => this.voiceRoomApi.leaveStageSeat(id),
      'Could not leave stage.',
      () => {
        if (generation === this.sessionGeneration) {
          void this.audio.setMicrophone(false);
        }
      },
    );
  }

  toggleHandRaised(): Promise<ActionFeedback> {
    return this.runRoomCommand(
      (id) => (this.handRaised() ? this.voiceRoomApi.lowerHand(id) : this.voiceRoomApi.raiseHand(id)),
      'Could not update hand state.',
    );
  }

  promoteToStage(targetUserId: string): Promise<ActionFeedback> {
    return this.runRoomCommand(
      (id) => this.voiceRoomApi.promoteSpeaker(id, targetUserId),
      'Could not promote to stage.',
    );
  }

  demoteToAudience(targetUserId: string): Promise<ActionFeedback> {
    return this.runRoomCommand(
      (id) => this.voiceRoomApi.demoteSpeaker(id, targetUserId),
      'Could not move speaker to audience.',
    );
  }

  remoteMuteSpeaker(targetUserId: string): Promise<ActionFeedback> {
    return this.runRoomCommand(
      (id) => this.voiceRoomApi.muteSpeaker(id, targetUserId),
      'Could not mute speaker.',
    );
  }

  removeParticipant(targetUserId: string): Promise<ActionFeedback> {
    return this.runRoomCommand(
      (id) => this.voiceRoomApi.kickParticipant(id, targetUserId),
      'Could not remove participant.',
    );
  }

  transferHost(targetUserId: string): Promise<ActionFeedback> {
    return this.runRoomCommand(
      (id) => this.voiceRoomApi.transferHost(id, targetUserId),
      'Could not transfer host role.',
    );
  }

  triggerStageReaction(reaction: BackendReaction): Promise<ActionFeedback> {
    return this.runRoomCommand(
      (id) => this.voiceRoomApi.sendReaction(id, reaction),
      'Could not send reaction.',
    );
  }

  applyRoomRealtimeEvent(event: RoomRealtimeEvent): void {
    switch (event.type) {
      case 'STAGE_UPDATED':
      case 'HAND_RAISED':
      case 'HAND_LOWERED':
        if (event.at >= this.lastStageEventAt) {
          this.lastStageEventAt = event.at;
          this.stage.set(event.stage);
          if (!this.isHost()) {
            this.roleState.set(
              event.stage.speakers.includes(this.currentUserId()) ? 'SPEAKER' : 'LISTENER',
            );
          }
          this.roomState.update(
            (room) => room && { ...room, handRaiseCount: event.stage.handRaiseQueue.length },
          );
          this.resolveMissingUsers([...event.stage.speakers, ...event.stage.handRaiseQueue]);
        }
        return;
      case 'SPEAKER_RECONNECTING':
      case 'SPEAKER_RECONNECTED':
        this.roomProfilesState.update((profiles) => {
          const current = profiles.get(event.userId);
          return current
            ? new Map(profiles).set(event.userId, {
                ...current,
                isReconnecting: event.type === 'SPEAKER_RECONNECTING',
              })
            : profiles;
        });
        return;
      case 'PRESENCE_CHANGED': {
        const speakers = new Set(this.stage().speakers);
        if (event.audienceCount !== undefined) this.audienceCount.set(event.audienceCount);
        this.roomState.update((curr) =>
          curr ? { ...curr, participantCount: event.participantCount } : curr,
        );
        const leftSet = new Set(event.left);
        const kept = this.audienceIds().filter((uid) => !leftSet.has(uid) && !speakers.has(uid));
        const existingIds = new Set(kept);
        const additions = event.joined.filter(
          (uid) => !existingIds.has(uid) && !speakers.has(uid),
        );
        const nextAudience = [...kept, ...additions].slice(0, this.audienceLimit());
        this.audienceIds.set(nextAudience);
        const addedVisible = nextAudience.slice(kept.length);
        if (addedVisible.length > 0) this.resolveMissingUsers(addedVisible);
        return;
      }
      case 'ROOM_UPDATED':
        if (event.hostId === this.currentUserId()) this.roleState.set('HOST');
        else if (event.hostId && this.isHost()) {
          this.roleState.set(
            this.stage().speakers.includes(this.currentUserId()) ? 'SPEAKER' : 'LISTENER',
          );
        }
        this.roomState.update((curr) =>
          curr
            ? {
                ...curr,
                title: event.title,
                topic: event.topic,
                maxStageSeats: event.maxStageSeats,
                ...(event.hostId ? { hostId: event.hostId } : {}),
              }
            : curr,
        );
        return;
      case 'REACTIONS': {
        const latest = event.reactions[event.reactions.length - 1];
        if (latest) this.flashStageReaction(emojiForReaction(latest.reaction));
        return;
      }
      case 'PARTICIPANT_PROFILE_UPDATED':
        this.identity.updateCachedAvatar(event.userId, event.avatarUrl);
        this.roomProfilesState.update((profiles) => {
          const current = profiles.get(event.userId);
          return current
            ? new Map(profiles).set(event.userId, { ...current, avatarUrl: event.avatarUrl })
            : profiles;
        });
        return;
      default: {
        const exhaustive: never = event;
        void exhaustive;
      }
    }
  }

  reset(): void {
    this.sessionGeneration++;
    this.audienceRequest.set(null);
    this.clearReactionTimer();
    this.stageReaction.set(null);
    this.roleState.set('LISTENER');
    this.roomState.set(null);
    this.audienceIds.set([]);
    this.roomProfilesState.set(new Map());
    this.audienceCount.set(0);
    this.audienceCursor.set(null);
    this.hasMoreAudience.set(false);
    this.audienceLimit.set(AUDIENCE_INITIAL_LIMIT);
    this.stage.set({ speakers: [], handRaiseQueue: [] });
    this.lastStageEventAt = 0;
  }

  private profileFor(userId: string) {
    return this.identity.userDirectory().get(userId) ?? this.roomProfilesState().get(userId);
  }

  private applySnapshotAudience(snapshot: RoomJoinSnapshot): void {
    this.audienceIds.set(snapshot.audience.audiencePreview.map(({ userId }) => userId));
    this.audienceCount.set(snapshot.audienceCount);
    this.audienceCursor.set(snapshot.audience.nextCursor);
    this.hasMoreAudience.set(snapshot.audience.hasMoreAudience);
    this.audienceLimit.set(AUDIENCE_INITIAL_LIMIT);
  }

  private cachePreviews(previews: readonly ParticipantPreview[]): void {
    this.roomProfilesState.update(
      (existing) =>
        new Map([
          ...existing,
          ...previews.map((preview) => [preview.userId, preview] as const),
        ]),
    );
  }

  private flashStageReaction(emoji: string): void {
    this.stageReaction.set(emoji);
    this.stageReactionKey.update((k) => k + 1);
    this.clearReactionTimer();
    this.reactionTimeout = setTimeout(() => this.stageReaction.set(null), 1800);
  }

  private clearReactionTimer(): void {
    if (this.reactionTimeout !== null) {
      clearTimeout(this.reactionTimeout);
      this.reactionTimeout = null;
    }
  }
}
