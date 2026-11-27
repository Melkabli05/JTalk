import { computed, DestroyRef, inject, Service, signal } from '@angular/core';
import { finalize, type Observable } from 'rxjs';
import { IdentityStore } from '../../../core/auth/identity';
import { errorMessage } from '../../../core/http/http-error.interceptor';
import { languageNameFor } from '../../../core/utils/language-codes';
import {
  emojiForReaction,
  isBackendReaction,
  type BackendRoomRole,
  type ParticipantPreview,
  type RoomJoinSnapshot,
  type RoomRealtimeEvent,
  type RoomSessionDto,
  type RoomSnapshotDto,
  type StageDto,
  type VoiceRoomDto,
} from '../../../shared/models/voice-room.model';
import { avatarChipClassFor } from '../../../shared/utils/avatar-chip.utils';
import { AUDIENCE_INITIAL_LIMIT, DEFAULT_MAX_STAGE_SEATS } from '../constants/room.constants';
import { LiveKitAudioEngine } from '../data-access/livekit-audio-engine';
import { VoiceRoomApi } from '../data-access/voice-room-api';
import type {
  ActionFeedback,
  RoomListener,
  RoomSpeaker,
  StageReaction,
} from '../models/live-room.model';

@Service()
export class RoomStageStore {
  private readonly destroyRef = inject(DestroyRef);
  private readonly voiceRoomApi = inject(VoiceRoomApi);
  private readonly identity = inject(IdentityStore);
  private readonly audio = inject(LiveKitAudioEngine);

  private sessionGeneration = 0;
  private lastStageEventAt = 0;

  private readonly roomState = signal<VoiceRoomDto | null>(null);
  private readonly roleState = signal<BackendRoomRole>('LISTENER');
  private readonly audienceCursor = signal<string | null>(null);
  private readonly audienceLimit = signal(AUDIENCE_INITIAL_LIMIT);

  private readonly stageState = signal<StageDto>({ speakers: [], handRaiseQueue: [] });
  private readonly reconnectingSpeakerIdsState = signal<ReadonlySet<string>>(new Set());
  private readonly claimingSeatState = signal(false);
  private readonly leavingStageState = signal(false);
  private readonly togglingHandState = signal(false);
  private readonly audienceIdsState = signal<readonly string[]>([]);
  private readonly audienceCountState = signal(0);
  private readonly hasMoreAudienceState = signal(false);
  private readonly audienceLoadingState = signal(false);
  private readonly stageReactionsState = signal<readonly StageReaction[]>([]);
  private readonly hostReconnectingState = signal(false);
  private readonly idleWarningState = signal(false);
  private readonly reactionTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextReactionId = 0;
  private nextReactionLane = 0;

  readonly room = this.roomState.asReadonly();
  readonly roomId = computed(() => this.room()?.id ?? null);
  readonly currentUserId = computed(() => this.identity.userId() ?? '');
  readonly isHost = computed(() => this.roleState() === 'HOST');
  readonly isModerator = computed(() => this.roleState() === 'MODERATOR');
  readonly canModerate = computed(() => this.isHost() || this.isModerator());
  readonly moderatorIds = computed(() => new Set(this.stageState().moderators ?? []));
  readonly isCurrentUserOnStage = computed(() =>
    this.stageState().speakers.includes(this.currentUserId()),
  );

  readonly stage = this.stageState.asReadonly();
  readonly claimingSeat = this.claimingSeatState.asReadonly();
  readonly leavingStage = this.leavingStageState.asReadonly();
  readonly togglingHand = this.togglingHandState.asReadonly();
  readonly audienceIds = this.audienceIdsState.asReadonly();
  readonly audienceCount = this.audienceCountState.asReadonly();
  readonly hasMoreAudience = this.hasMoreAudienceState.asReadonly();
  readonly audienceLoading = this.audienceLoadingState.asReadonly();
  readonly stageReactions = this.stageReactionsState.asReadonly();
  readonly hostReconnecting = this.hostReconnectingState.asReadonly();
  readonly idleWarning = this.idleWarningState.asReadonly();
  readonly stageReaction = computed(() => this.stageReactionsState().at(-1) ?? null);
  readonly stageReactionKey = computed(() => this.stageReactionsState().at(-1)?.id ?? 0);
  readonly speakerReactions = computed<ReadonlyMap<string, string>>(() => {
    const map = new Map<string, string>();
    for (const reaction of this.stageReactionsState()) {
      map.set(reaction.userId, reaction.emoji);
    }
    return map;
  });

  readonly effectiveRoomTitle = computed(() => this.room()?.title || 'Live room');
  readonly effectiveMaxSeats = computed(
    () => this.room()?.maxStageSeats ?? DEFAULT_MAX_STAGE_SEATS,
  );
  readonly practiseLangLabel = computed(() => languageNameFor(this.room()?.targetLanguage));

  readonly hostName = computed(() => {
    const hostId = this.room()?.hostId;
    return hostId
      ? this.resolveDisplayName(hostId, 'Host')
      : (this.identity.me()?.displayName ?? 'Speaker');
  });

  readonly speakers = computed<readonly RoomSpeaker[]>(() => {
    const hostId = this.room()?.hostId;
    const myId = this.currentUserId();
    const activeIds = this.audio.speakingIdSet();
    const mutedIds = this.audio.mutedIdSet();
    const reconnectingIds = this.reconnectingSpeakerIdsState();
    return this.stage().speakers.map((userId) => {
      const isYou = userId === myId;
      const muted = isYou ? !this.audio.micOn() : mutedIds.has(userId);
      const reconnecting = reconnectingIds.has(userId);
      return {
        ...this.resolveParticipantCard(userId, 'Speaker'),
        role: hostId === userId ? 'host' : 'speaker',
        isYou,
        muted,
        speaking: activeIds.has(userId) && !muted && !reconnecting,
        reconnecting,
      };
    });
  });

  readonly listeners = computed<readonly RoomListener[]>(() => {
    const speakerSet = new Set(this.stage().speakers);
    const handQueue = new Set(this.stage().handRaiseQueue);
    return this.audienceIds()
      .filter((userId) => !speakerSet.has(userId))
      .map((userId) => ({
        ...this.resolveParticipantCard(userId, 'Listener'),
        handRaised: handQueue.has(userId),
      }));
  });

  readonly pendingRequests = computed(() =>
    this.stage().handRaiseQueue.map((userId) => this.resolveParticipantCard(userId, 'Listener')),
  );

  readonly handRaised = computed(() => {
    const myId = this.currentUserId();
    return Boolean(myId && this.stage().handRaiseQueue.includes(myId));
  });

  readonly canClaimStageSeat = computed(
    () =>
      this.isModerator() &&
      !this.isCurrentUserOnStage() &&
      this.stage().speakers.length < this.effectiveMaxSeats(),
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.clearReactionTimers());
  }

  generation(): number {
    return this.sessionGeneration;
  }

  bumpGeneration(): number {
    return ++this.sessionGeneration;
  }

  resolveDisplayName(userId: string, fallback: string): string {
    return (
      this.identity.userDirectory().get(userId)?.displayName ??
      (userId === this.currentUserId() ? (this.identity.me()?.displayName ?? fallback) : fallback)
    );
  }

  resolveAvatarUrl(userId: string): string | null {
    return (
      this.identity.userDirectory().get(userId)?.avatarUrl ??
      (userId === this.currentUserId() ? (this.identity.me()?.avatarUrl ?? null) : null)
    );
  }

  resolveMissingUsers(ids: readonly string[]): void {
    const directory = this.identity.userDirectory();
    const missing = ids.filter((id) => !directory.get(id)?.displayName);
    if (missing.length > 0) {
      void this.identity.resolveUsers(missing);
    }
  }

  runRoomCommand<T>(
    request: (roomId: string) => Observable<T>,
    failureMessage: string,
    onSuccess?: () => void,
    onDone?: (res: ActionFeedback) => void,
  ): void {
    const id = this.roomId();
    if (!id) {
      onDone?.({ ok: false, message: 'No active room.' });
      return;
    }
    request(id).subscribe({
      next: () => {
        onSuccess?.();
        onDone?.({ ok: true });
      },
      error: (err: unknown) => {
        onDone?.({ ok: false, message: errorMessage(err, failureMessage) });
      },
    });
  }

  applySessionStart(session: RoomSessionDto): void {
    this.roleState.set(session.role);
    this.roomState.set(session.room);
    this.stageState.set({ speakers: session.room.speakers, handRaiseQueue: [] });
    const existing = this.identity.userDirectory();
    const summaries = [
      ...(session.room.host ? [session.room.host] : []),
      ...(session.room.speakerProfiles ?? []),
      ...(session.room.participantProfiles ?? []),
    ]
      .filter((s) => Boolean(s.displayName || s.username))
      .map((s) => {
        const prev = existing.get(s.id);
        return {
          id: s.id,
          username: s.username ?? prev?.username ?? '',
          displayName: s.displayName ?? prev?.displayName ?? s.username ?? 'Speaker',
          avatarUrl: s.avatarUrl ?? prev?.avatarUrl ?? null,
          countryCode: s.countryCode ?? prev?.countryCode ?? null,
          nativeLanguage: s.nativeLanguage ?? prev?.nativeLanguage ?? 'en',
        };
      });
    if (summaries.length > 0) {
      this.identity.mergeUserSummaries(summaries);
    }
  }

  applyJoinSnapshot(snapshot: RoomJoinSnapshot): void {
    this.cachePreviews([...snapshot.speakers, ...snapshot.audience.audiencePreview]);
    this.reconnectingSpeakerIdsState.set(
      new Set(snapshot.speakers.filter((s) => s.isReconnecting).map((s) => s.userId)),
    );
    this.stageState.set({
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
      this.reconnectingSpeakerIdsState.set(
        new Set(res.snapshot.speakers.filter((s) => s.isReconnecting).map((s) => s.userId)),
      );
      this.stageState.set({
        speakers: res.snapshot.speakers.map(({ userId }) => userId),
        handRaiseQueue: res.snapshot.handRaiseQueue,
      });
    }
    if (this.audienceIds() === before.audience) {
      this.applySnapshotAudience(res.snapshot);
    }
  }

  patchRoom(updated: Pick<VoiceRoomDto, 'title' | 'topic' | 'maxStageSeats'>): void {
    this.roomState.update((room): VoiceRoomDto | null =>
      room
        ? {
            ...room,
            title: updated.title,
            topic: updated.topic,
            maxStageSeats: updated.maxStageSeats,
          }
        : null,
    );
  }

  loadMoreAudience(onDone?: (res: ActionFeedback) => void): void {
    const roomId = this.roomId();
    const cursor = this.audienceCursor();
    if (!roomId || !this.hasMoreAudience() || this.audienceLoading()) {
      onDone?.({ ok: true });
      return;
    }
    const generation = this.sessionGeneration;
    this.audienceLoadingState.set(true);
    this.voiceRoomApi
      .getAudience(roomId, cursor)
      .pipe(
        finalize(() => {
          if (generation === this.sessionGeneration) this.audienceLoadingState.set(false);
        }),
      )
      .subscribe({
        next: (page) => {
          if (generation !== this.sessionGeneration || this.audienceCursor() !== cursor) {
            onDone?.({ ok: true });
            return;
          }
          this.cachePreviews(page.audiencePreview);
          this.audienceIdsState.update((ids): readonly string[] => {
            const existing = new Set(ids);
            return [
              ...ids,
              ...page.audiencePreview.map(({ userId }) => userId).filter((id) => !existing.has(id)),
            ];
          });
          this.audienceCursor.set(page.nextCursor);
          this.hasMoreAudienceState.set(page.hasMoreAudience);
          this.audienceLimit.update((limit): number => Math.max(limit, this.audienceIds().length));
          onDone?.({ ok: true });
        },
        error: (err: unknown) => {
          onDone?.({ ok: false, message: errorMessage(err, 'Could not load more listeners.') });
        },
      });
  }

  claimStageSeat(onDone?: (res: ActionFeedback) => void): void {
    const id = this.roomId();
    if (!id) {
      onDone?.({ ok: false, message: 'No active room.' });
      return;
    }
    if (this.claimingSeatState()) return;
    const generation = this.sessionGeneration;
    const stage = this.stage();
    this.claimingSeatState.set(true);
    this.voiceRoomApi
      .claimStageSeat(id)
      .pipe(
        finalize(() => {
          if (generation === this.sessionGeneration) this.claimingSeatState.set(false);
        }),
      )
      .subscribe({
        next: (session) => {
          if (generation !== this.sessionGeneration) {
            onDone?.({ ok: false });
            return;
          }
          if (this.stage() === stage) {
            this.roleState.set(session.role);
            this.stageState.set({
              speakers: session.room.speakers,
              handRaiseQueue: stage.handRaiseQueue.filter(
                (userId) => userId !== this.currentUserId(),
              ),
            });
          }
          if (!this.audio.canPublish()) {
            this.audio.connectSession(session, (connected) => {
              if (generation !== this.sessionGeneration) {
                onDone?.({ ok: false });
                return;
              }
              onDone?.(
                connected
                  ? { ok: true }
                  : { ok: false, message: 'Stage seat claimed. Tap Retry audio to reconnect.' },
              );
            });
            return;
          }
          onDone?.({ ok: true });
        },
        error: (err: unknown) => {
          onDone?.({ ok: false, message: errorMessage(err, 'Could not join the stage.') });
        },
      });
  }

  leaveStage(onDone?: (res: ActionFeedback) => void): void {
    if (this.leavingStageState()) return;
    const generation = this.sessionGeneration;
    this.leavingStageState.set(true);
    this.runRoomCommand(
      (id) => this.voiceRoomApi.leaveStageSeat(id),
      'Could not leave stage.',
      () => {
        if (generation === this.sessionGeneration) {
          void this.audio.setMicrophone(false);
        }
      },
      (res) => {
        if (generation === this.sessionGeneration) this.leavingStageState.set(false);
        onDone?.(res);
      },
    );
  }

  toggleHandRaised(onDone?: (res: ActionFeedback) => void): void {
    if (this.togglingHandState()) return;
    const generation = this.sessionGeneration;
    this.togglingHandState.set(true);
    this.runRoomCommand(
      (id) =>
        this.handRaised() ? this.voiceRoomApi.lowerHand(id) : this.voiceRoomApi.raiseHand(id),
      'Could not update hand state.',
      undefined,
      (res) => {
        if (generation === this.sessionGeneration) this.togglingHandState.set(false);
        onDone?.(res);
      },
    );
  }

  applyRoomRealtimeEvent(event: RoomRealtimeEvent): void {
    switch (event.type) {
      case 'STAGE_UPDATED':
      case 'HAND_RAISED':
      case 'HAND_LOWERED': {
        const nextStage = event.stage;
        if (!nextStage) return;
        const at = event.timestamp ? Date.parse(event.timestamp) : NaN;
        if (Number.isFinite(at) && at < this.lastStageEventAt) return;
        if (Number.isFinite(at)) this.lastStageEventAt = at;

        const prevSpeakers = this.stage().speakers;
        const prevSpeakerSet = new Set(prevSpeakers);
        const nextSpeakerSet = new Set(nextStage.speakers);
        const demoted = prevSpeakers.filter((id) => !nextSpeakerSet.has(id));
        const promotedCount = nextStage.speakers.filter((id) => !prevSpeakerSet.has(id)).length;

        this.stageState.set(nextStage);
        if (!this.isHost()) {
          const onStage = nextSpeakerSet.has(this.currentUserId());
          this.roleState.set(onStage ? 'SPEAKER' : 'LISTENER');
          if (!onStage) {
            void this.audio.setMicrophone(false);
          }
        }
        if (demoted.length > 0 || promotedCount > 0) {
          this.audienceIdsState.update((ids) => {
            const kept = ids.filter((id) => !nextSpeakerSet.has(id));
            const seen = new Set(kept);
            const added = demoted.filter((id) => !seen.has(id));
            return [...kept, ...added].slice(0, this.audienceLimit());
          });
          this.audienceCountState.update((count) =>
            Math.max(0, count - promotedCount + demoted.length),
          );
        }
        this.roomState.update((room): VoiceRoomDto | null =>
          room ? { ...room, speakers: nextStage.speakers } : null,
        );
        this.resolveMissingUsers([...nextStage.speakers, ...nextStage.handRaiseQueue, ...demoted]);
        return;
      }
      case 'PRESENCE_CHANGED': {
        const presence = event.presence;
        if (!presence) return;
        const speakers = new Set(this.stage().speakers);
        if (presence.audienceCount !== undefined)
          this.audienceCountState.set(presence.audienceCount);
        this.roomState.update((curr): VoiceRoomDto | null =>
          curr ? { ...curr, participantCount: presence.participantCount } : curr,
        );
        const leftSet = new Set(presence.left);
        const kept = this.audienceIds().filter((uid) => !leftSet.has(uid) && !speakers.has(uid));
        const existingIds = new Set(kept);
        const additions = presence.joined.filter(
          (uid) => !existingIds.has(uid) && !speakers.has(uid),
        );
        const nextAudience = [...kept, ...additions].slice(0, this.audienceLimit());
        this.audienceIdsState.set(nextAudience);
        const addedVisible = nextAudience.slice(kept.length);
        if (addedVisible.length > 0) this.resolveMissingUsers(addedVisible);
        return;
      }
      case 'ROOM_UPDATED': {
        const settings = event.settings;
        if (!settings) return;
        if (settings.hostId === this.currentUserId()) this.roleState.set('HOST');
        else if (settings.hostId && this.isHost()) {
          this.roleState.set(
            this.stage().speakers.includes(this.currentUserId()) ? 'SPEAKER' : 'LISTENER',
          );
        }
        this.roomState.update((curr): VoiceRoomDto | null =>
          curr
            ? {
                ...curr,
                title: settings.title,
                topic: settings.topic ?? '',
                maxStageSeats: settings.maxStageSeats,
                ...(settings.hostId ? { hostId: settings.hostId } : {}),
              }
            : curr,
        );
        return;
      }
      case 'REACTIONS': {
        for (const item of event.reactions ?? []) {
          if (isBackendReaction(item.reaction)) {
            const reactorName =
              item.userId === this.currentUserId()
                ? 'You'
                : this.resolveDisplayName(item.userId, 'Listener');
            this.flashStageReaction(item.userId, emojiForReaction(item.reaction), reactorName);
          }
        }
        return;
      }
      case 'PARTICIPANT_PROFILE_UPDATED':
        if (event.profileUpdate) {
          this.identity.updateCachedAvatar(
            event.profileUpdate.userId,
            event.profileUpdate.avatarUrl,
          );
        }
        return;
      case 'SPEAKER_RECONNECTING': {
        const userId = event.targetUserId;
        if (userId) {
          this.reconnectingSpeakerIdsState.update((prev): ReadonlySet<string> =>
            new Set(prev).add(userId),
          );
        }
        return;
      }
      case 'SPEAKER_RECONNECTED': {
        const userId = event.targetUserId;
        if (userId) {
          this.reconnectingSpeakerIdsState.update((prev): ReadonlySet<string> => {
            if (!prev.has(userId)) return prev;
            const next = new Set(prev);
            next.delete(userId);
            return next;
          });
        }
        return;
      }
      case 'COMMENT_PINNED':
      case 'COMMENT_UNPINNED':
        return;
      case 'HOST_RECONNECTING':
        this.hostReconnectingState.set(true);
        return;
      case 'HOST_RECONNECTED':
        this.hostReconnectingState.set(false);
        return;
      case 'HOST_TRANSFERRED': {
        this.hostReconnectingState.set(false);
        const newHostId = event.targetUserId;
        if (newHostId) {
          this.roomState.update((curr) => (curr ? { ...curr, hostId: newHostId } : curr));
          if (newHostId === this.currentUserId()) {
            this.roleState.set('HOST');
          } else if (this.roleState() === 'HOST') {
            this.roleState.set('SPEAKER');
          }
        }
        return;
      }
      case 'ROOM_IDLE_WARNING':
        if (this.isHost()) {
          this.idleWarningState.set(true);
        }
        return;
    }
  }

  reset(): void {
    this.sessionGeneration++;
    this.audienceLoadingState.set(false);
    this.claimingSeatState.set(false);
    this.leavingStageState.set(false);
    this.togglingHandState.set(false);
    this.reconnectingSpeakerIdsState.set(new Set());
    this.clearReactionTimers();
    this.stageReactionsState.set([]);
    this.hostReconnectingState.set(false);
    this.idleWarningState.set(false);
    this.roleState.set('LISTENER');
    this.roomState.set(null);
    this.audienceIdsState.set([]);
    this.audienceCountState.set(0);
    this.audienceCursor.set(null);
    this.hasMoreAudienceState.set(false);
    this.audienceLimit.set(AUDIENCE_INITIAL_LIMIT);
    this.stageState.set({ speakers: [], handRaiseQueue: [] });
    this.lastStageEventAt = 0;
  }

  private applySnapshotAudience(snapshot: RoomJoinSnapshot): void {
    this.audienceIdsState.set(snapshot.audience.audiencePreview.map(({ userId }) => userId));
    this.audienceCountState.set(snapshot.audienceCount);
    this.audienceCursor.set(snapshot.audience.nextCursor);
    this.hasMoreAudienceState.set(snapshot.audience.hasMoreAudience);
    this.audienceLimit.set(AUDIENCE_INITIAL_LIMIT);
  }

  private cachePreviews(previews: readonly ParticipantPreview[]): void {
    const existing = this.identity.userDirectory();
    const summaries = previews
      .filter((preview): preview is ParticipantPreview & { readonly displayName: string } =>
        Boolean(preview.displayName),
      )
      .map((preview) => {
        const prev = existing.get(preview.userId);
        return {
          id: preview.userId,
          username: prev?.username ?? '',
          displayName: preview.displayName,
          avatarUrl: preview.avatarUrl ?? prev?.avatarUrl ?? null,
          countryCode: prev?.countryCode ?? null,
          nativeLanguage: preview.nativeLanguage ?? prev?.nativeLanguage ?? 'en',
        };
      });
    this.identity.mergeUserSummaries(summaries);
  }

  private resolveParticipantCard(userId: string, fallback: 'Speaker' | 'Listener') {
    const name = this.resolveDisplayName(userId, fallback);
    return {
      id: userId,
      avatarUrl: this.resolveAvatarUrl(userId),
      name,
      initial: (name.trim()[0] ?? fallback.charAt(0)).toUpperCase(),
      chipClass: avatarChipClassFor(userId),
    };
  }

  dismissIdleWarning(): void {
    this.idleWarningState.set(false);
  }

  private flashStageReaction(userId: string, emoji: string, reactorName: string): void {
    const id = ++this.nextReactionId;
    const current = this.stageReactionsState();
    const existing = current.find((item) => item.userId === userId && item.emoji === emoji);

    let next: readonly StageReaction[];
    if (existing) {
      this.clearReactionTimer(existing.id);
      const updated: StageReaction = {
        ...existing,
        id,
        reactorName,
        count: existing.count + 1,
      };
      next = [...current.filter((item) => item.id !== existing.id), updated];
    } else {
      const created: StageReaction = {
        id,
        userId,
        emoji,
        reactorName,
        count: 1,
        lane: this.nextReactionLane++ % 4,
      };
      const combined = [...current, created];
      if (combined.length > 4) {
        const evicted = combined[0];
        if (evicted) this.clearReactionTimer(evicted.id);
        next = combined.slice(combined.length - 4);
      } else {
        next = combined;
      }
    }

    this.stageReactionsState.set(next);
    const timer = setTimeout(() => {
      this.reactionTimers.delete(id);
      this.stageReactionsState.update((list) => list.filter((item) => item.id !== id));
    }, 2400);
    this.reactionTimers.set(id, timer);
  }

  private clearReactionTimer(id: number): void {
    const timer = this.reactionTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.reactionTimers.delete(id);
    }
  }

  private clearReactionTimers(): void {
    for (const timer of this.reactionTimers.values()) {
      clearTimeout(timer);
    }
    this.reactionTimers.clear();
  }
}
