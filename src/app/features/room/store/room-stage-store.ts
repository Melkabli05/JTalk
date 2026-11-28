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
  ToolbarPendingRequest,
} from '../models/live-room.model';
import {
  deriveSpeakerMuteState,
  orderListenersByRaisedHand,
  pruneHandRaiseQueue,
} from '../utils/room-moderation.utils';

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
  private readonly moderatorIdsState = signal<ReadonlySet<string>>(new Set());
  private readonly hostMutedIdsState = signal<ReadonlySet<string>>(new Set());
  private readonly reactionTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextReactionId = 0;
  private nextReactionLane = 0;

  readonly room = this.roomState.asReadonly();
  readonly roomId = computed(() => this.room()?.id ?? null);
  readonly hostId = computed(() => this.room()?.hostId ?? null);
  readonly currentUserId = computed(() => this.identity.userId() ?? '');
  readonly isHost = computed(() => this.roleState() === 'HOST');
  readonly moderatorIds = this.moderatorIdsState.asReadonly();
  readonly hostMutedIds = this.hostMutedIdsState.asReadonly();
  readonly isModerator = computed(() => this.moderatorIdsState().has(this.currentUserId()));
  readonly canModerate = computed(() => this.isHost() || this.isModerator());
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
    const hostMutedIds = this.hostMutedIdsState();
    const localMicOn = this.audio.micOn();
    const localMutedByHost =
      this.audio.isMutedByHost() ||
      (this.audio.status() === 'connected' && !this.audio.canPublish());
    const reconnectingIds = this.reconnectingSpeakerIdsState();
    return this.stage().speakers.map((userId) => {
      const isYou = userId === myId;
      const { muted, muteReason } = deriveSpeakerMuteState({
        userId,
        isYou,
        localMicOn,
        localMutedByHost,
        hostMutedIds,
        remoteMutedIds: mutedIds,
      });
      const reconnecting = reconnectingIds.has(userId);
      return {
        ...this.resolveParticipantCard(userId, 'Speaker'),
        role: hostId === userId ? 'host' : 'speaker',
        isYou,
        muted,
        ...(muteReason ? { muteReason } : {}),
        speaking: activeIds.has(userId) && !muted && !reconnecting,
        reconnecting,
      };
    });
  });

  readonly listeners = computed<readonly RoomListener[]>(() => {
    const stage = this.stage();
    const speakerSet = new Set(stage.speakers);
    const handQueue = new Set(stage.handRaiseQueue);
    return orderListenersByRaisedHand(this.audienceIds(), stage.handRaiseQueue, speakerSet).map(
      (userId) => ({
        ...this.resolveParticipantCard(userId, 'Listener'),
        handRaised: handQueue.has(userId),
      }),
    );
  });

  readonly pendingRequests = computed<readonly ToolbarPendingRequest[]>(() =>
    this.stage().handRaiseQueue.map((userId, index) => ({
      ...this.resolveParticipantCard(userId, 'Listener'),
      position: index + 1,
    })),
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
    const myId = this.currentUserId();
    this.moderatorIdsState.set(session.isModerator && myId ? new Set([myId]) : new Set());
    this.hostMutedIdsState.set(session.isMutedByHost && myId ? new Set([myId]) : new Set());
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
    this.cachePreviews([
      ...snapshot.speakers,
      ...snapshot.audience.audiencePreview,
      ...(snapshot.handRaiseProfiles ?? []),
    ]);
    const speakerIds = snapshot.speakers.map(({ userId }) => userId);
    const speakerSet = new Set(speakerIds);
    const prunedQueue = pruneHandRaiseQueue(snapshot.handRaiseQueue, new Set(), speakerSet);
    this.reconnectingSpeakerIdsState.set(
      new Set(snapshot.speakers.filter((s) => s.isReconnecting).map((s) => s.userId)),
    );
    if (snapshot.moderators) {
      this.moderatorIdsState.set(new Set(snapshot.moderators));
    }
    if (snapshot.hostMuted) {
      const nextMuted = new Set(snapshot.hostMuted.filter((id) => speakerSet.has(id)));
      const myId = this.currentUserId();
      if (this.audio.isMutedByHost() && myId && speakerSet.has(myId)) {
        nextMuted.add(myId);
      }
      this.hostMutedIdsState.set(nextMuted);
    }
    this.stageState.set({
      speakers: speakerIds,
      handRaiseQueue: prunedQueue,
    });
    this.roomState.update((room): VoiceRoomDto | null =>
      room ? { ...room, speakers: speakerIds, handRaiseCount: prunedQueue.length } : null,
    );
    this.applySnapshotAudience(snapshot);
    this.resolveMissingUsers(prunedQueue);
  }

  applyResyncSnapshot(
    res: RoomSnapshotDto,
    before: { room: VoiceRoomDto; stage: StageDto; audience: readonly string[] },
  ): void {
    if (this.room() === before.room && this.stage() === before.stage) {
      this.roleState.set(res.role);
      const myId = this.currentUserId();
      if (res.snapshot.moderators) {
        this.moderatorIdsState.set(new Set(res.snapshot.moderators));
      } else if (res.isModerator !== undefined && myId) {
        this.moderatorIdsState.update((prev) => {
          const next = new Set(prev);
          if (res.isModerator) next.add(myId);
          else next.delete(myId);
          return next;
        });
      }
    }
    if (this.room() === before.room) {
      this.roomState.set(res.room);
    }
    this.cachePreviews([
      ...res.snapshot.speakers,
      ...res.snapshot.audience.audiencePreview,
      ...(res.snapshot.handRaiseProfiles ?? []),
    ]);
    if (this.stage() === before.stage) {
      const speakerIds = res.snapshot.speakers.map(({ userId }) => userId);
      const speakerSet = new Set(speakerIds);
      const prunedQueue = pruneHandRaiseQueue(res.snapshot.handRaiseQueue, new Set(), speakerSet);
      this.reconnectingSpeakerIdsState.set(
        new Set(res.snapshot.speakers.filter((s) => s.isReconnecting).map((s) => s.userId)),
      );
      if (res.snapshot.hostMuted) {
        this.hostMutedIdsState.set(
          new Set(res.snapshot.hostMuted.filter((id) => speakerSet.has(id))),
        );
      }
      this.stageState.set({
        speakers: speakerIds,
        handRaiseQueue: prunedQueue,
      });
      this.roomState.update((room): VoiceRoomDto | null =>
        room ? { ...room, speakers: speakerIds, handRaiseCount: prunedQueue.length } : null,
      );
      this.resolveMissingUsers(prunedQueue);
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
    const wasRaised = this.handRaised();
    const myId = this.currentUserId();
    this.togglingHandState.set(true);
    this.runRoomCommand(
      (id) => (wasRaised ? this.voiceRoomApi.lowerHand(id) : this.voiceRoomApi.raiseHand(id)),
      'Could not update hand state.',
      () => {
        if (generation !== this.sessionGeneration || !myId) return;
        this.stageState.update((curr) => {
          const nextQueue = wasRaised
            ? curr.handRaiseQueue.filter((uid) => uid !== myId)
            : curr.handRaiseQueue.includes(myId)
              ? curr.handRaiseQueue
              : [...curr.handRaiseQueue, myId];
          return { ...curr, handRaiseQueue: nextQueue };
        });
        this.syncRoomHandCount();
      },
      (res) => {
        if (generation === this.sessionGeneration) this.togglingHandState.set(false);
        onDone?.(res);
      },
    );
  }

  dismissHandRaise(targetUserId: string, onDone?: (res: ActionFeedback) => void): void {
    const generation = this.sessionGeneration;
    this.runRoomCommand(
      (id) => this.voiceRoomApi.dismissHandRaise(id, targetUserId),
      'Could not dismiss raised hand.',
      () => {
        if (generation !== this.sessionGeneration) return;
        this.stageState.update((curr) => ({
          ...curr,
          handRaiseQueue: curr.handRaiseQueue.filter((uid) => uid !== targetUserId),
        }));
        this.syncRoomHandCount();
      },
      onDone,
    );
  }

  promoteToStage(targetUserId: string, onDone?: (res: ActionFeedback) => void): void {
    const generation = this.sessionGeneration;
    this.runRoomCommand(
      (id) => this.voiceRoomApi.promoteSpeaker(id, targetUserId),
      'Could not promote to stage.',
      () => {
        if (generation !== this.sessionGeneration) return;
        this.updateHostMutedId(targetUserId, false);
        this.stageState.update((curr) => {
          const speakers = curr.speakers.includes(targetUserId)
            ? curr.speakers
            : [...curr.speakers, targetUserId];
          const handRaiseQueue = curr.handRaiseQueue.filter((uid) => uid !== targetUserId);
          return { ...curr, speakers, handRaiseQueue };
        });
        this.audienceIdsState.update((ids) => ids.filter((uid) => uid !== targetUserId));
        this.syncRoomHandCount();
      },
      onDone,
    );
  }

  setSpeakerHostMuted(
    targetUserId: string,
    muted: boolean,
    onDone?: (res: ActionFeedback) => void,
  ): void {
    const generation = this.sessionGeneration;
    this.runRoomCommand(
      (id) =>
        muted
          ? this.voiceRoomApi.muteSpeaker(id, targetUserId)
          : this.voiceRoomApi.unmuteSpeaker(id, targetUserId),
      muted ? 'Could not mute speaker.' : 'Could not unmute speaker.',
      () => {
        if (generation !== this.sessionGeneration) return;
        this.updateHostMutedId(targetUserId, muted);
      },
      onDone,
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
        const prunedQueue = pruneHandRaiseQueue(nextStage.handRaiseQueue, new Set(), nextSpeakerSet);
        const normalizedStage: StageDto = { ...nextStage, handRaiseQueue: prunedQueue };
        const demoted = prevSpeakers.filter((id) => !nextSpeakerSet.has(id));
        const promotedCount = nextStage.speakers.filter((id) => !prevSpeakerSet.has(id)).length;

        this.stageState.set(normalizedStage);
        if (nextStage.moderators) {
          this.moderatorIdsState.set(new Set(nextStage.moderators));
        }
        if (nextStage.hostMuted) {
          this.hostMutedIdsState.set(
            new Set(nextStage.hostMuted.filter((id) => nextSpeakerSet.has(id))),
          );
        } else {
          this.hostMutedIdsState.update((prev) => {
            const kept = new Set([...prev].filter((id) => nextSpeakerSet.has(id)));
            return kept.size === prev.size ? prev : kept;
          });
        }
        if (!this.isHost()) {
          const onStage = nextSpeakerSet.has(this.currentUserId());
          this.roleState.set(onStage ? 'SPEAKER' : 'LISTENER');
          if (!onStage) {
            void this.audio.setMicrophone(false, false);
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
          room
            ? {
                ...room,
                speakers: normalizedStage.speakers,
                handRaiseCount: prunedQueue.length,
              }
            : null,
        );
        this.resolveMissingUsers([...normalizedStage.speakers, ...prunedQueue, ...demoted]);
        return;
      }
      case 'SPEAKER_MUTED': {
        const userId = event.targetUserId;
        if (!userId) return;
        this.updateHostMutedId(userId, true);
        if (userId === this.currentUserId()) {
          this.audio.applyHostMute(true);
        }
        return;
      }
      case 'SPEAKER_UNMUTED': {
        const userId = event.targetUserId;
        if (!userId) return;
        this.updateHostMutedId(userId, false);
        if (userId === this.currentUserId()) {
          this.audio.applyHostMute(false);
        }
        return;
      }
      case 'PRESENCE_CHANGED': {
        const presence = event.presence;
        if (!presence) return;
        const speakers = new Set(this.stage().speakers);
        const leftSet = new Set(presence.left);
        if (presence.audienceCount !== undefined)
          this.audienceCountState.set(presence.audienceCount);

        let prunedHandCount = this.stage().handRaiseQueue.length;
        if (leftSet.size > 0) {
          const nextQueue = pruneHandRaiseQueue(this.stage().handRaiseQueue, leftSet, speakers);
          prunedHandCount = nextQueue.length;
          if (nextQueue !== this.stage().handRaiseQueue) {
            this.stageState.update((curr) => ({ ...curr, handRaiseQueue: nextQueue }));
          }
          this.hostMutedIdsState.update((prev) => {
            let changed = false;
            const next = new Set(prev);
            for (const uid of leftSet) {
              if (next.delete(uid)) changed = true;
            }
            return changed ? next : prev;
          });
          this.reconnectingSpeakerIdsState.update((prev) => {
            let changed = false;
            const next = new Set(prev);
            for (const uid of leftSet) {
              if (next.delete(uid)) changed = true;
            }
            return changed ? next : prev;
          });
        }

        this.roomState.update((curr): VoiceRoomDto | null =>
          curr
            ? {
                ...curr,
                participantCount: presence.participantCount,
                handRaiseCount: prunedHandCount,
              }
            : curr,
        );
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
          this.moderatorIdsState.update((prev) => {
            if (!prev.has(newHostId)) return prev;
            const next = new Set(prev);
            next.delete(newHostId);
            return next;
          });
          if (newHostId === this.currentUserId()) {
            this.roleState.set('HOST');
          } else if (this.roleState() === 'HOST') {
            this.roleState.set('SPEAKER');
          }
        }
        return;
      }
      case 'MODERATOR_ASSIGNED': {
        const targetId = event.targetUserId;
        if (targetId) {
          this.moderatorIdsState.update((prev) => new Set(prev).add(targetId));
        }
        return;
      }
      case 'MODERATOR_REVOKED': {
        const targetId = event.targetUserId;
        if (targetId) {
          this.moderatorIdsState.update((prev) => {
            if (!prev.has(targetId)) return prev;
            const next = new Set(prev);
            next.delete(targetId);
            return next;
          });
        }
        return;
      }
      case 'ROOM_IDLE_WARNING':
        if (this.isHost()) {
          this.idleWarningState.set(true);
        }
        return;
      case 'ROOM_CLOSED_HOST_ABSENT':
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
    this.moderatorIdsState.set(new Set());
    this.hostMutedIdsState.set(new Set());
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

  private updateHostMutedId(userId: string, muted: boolean): void {
    this.hostMutedIdsState.update((prev): ReadonlySet<string> => {
      if (muted) {
        if (prev.has(userId)) return prev;
        return new Set(prev).add(userId);
      }
      if (!prev.has(userId)) return prev;
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  }

  private syncRoomHandCount(): void {
    const count = this.stageState().handRaiseQueue.length;
    this.roomState.update((room): VoiceRoomDto | null =>
      room ? { ...room, handRaiseCount: count } : null,
    );
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
