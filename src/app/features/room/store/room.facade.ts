import {
  computed,
  DestroyRef,
  effect,
  inject,
  Service,
  type Signal,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { UserProfileResponse } from '../../../core/auth/auth.models';
import { IdentityStore } from '../../../core/auth/identity';
import { UsersApi } from '../../../core/auth/users-api';
import { errorMessage } from '../../../core/http/http-error.interceptor';
import { AppTitleStrategy } from '../../../core/routing/app-title-strategy';
import { ToastNotifier } from '../../../core/services/toast-notifier';
import type {
  BackendReaction,
  UpdateVoiceRoomPayload,
} from '../../../shared/models/voice-room.model';
import { VoiceRoomApi } from '../data-access/voice-room-api';
import type {
  ActionFeedback,
  DiscussionMessage,
  HostProfileDialogData,
  ListenerMenuAction,
  ProfilePreviewTarget,
  RoomListener,
  StageReaction,
  RoomSpeaker,
  SpeakerMenuAction,
} from '../models/live-room.model';
import type {
  AudioDeviceOption,
  LiveKitConnectionStatus,
  NoiseIsolationMode,
} from '../models/livekit.model';
import { LiveRoomStore } from './live-room-store';
import { RoomChatStore } from './room-chat-store';
import { RoomStageStore } from './room-stage-store';

@Service()
export class RoomFacade {
  private readonly roomStore = inject(LiveRoomStore);
  private readonly stageStore = inject(RoomStageStore);
  private readonly chatStore = inject(RoomChatStore);
  private readonly voiceRoomApi = inject(VoiceRoomApi);
  private readonly usersApi = inject(UsersApi);
  private readonly identity = inject(IdentityStore, { optional: true });
  private readonly router = inject(Router);
  private readonly toast = inject(ToastNotifier);
  private readonly destroyRef = inject(DestroyRef);
  private readonly titleStrategy = inject(AppTitleStrategy);

  private profilePreviewSeq = 0;

  private readonly sendingCommentState = signal(false);
  readonly sendingComment: Signal<boolean> = this.sendingCommentState.asReadonly();
  private readonly reconnectingAudioState = signal(false);
  private readonly leavingRoomState = signal(false);
  readonly leavingRoom = this.leavingRoomState.asReadonly();
  readonly reconnectingAudio: Signal<boolean> = this.reconnectingAudioState.asReadonly();

  readonly roomId: Signal<string | null> = this.roomStore.roomId;
  readonly roomLoading: Signal<boolean> = this.roomStore.roomLoading;
  readonly roomError: Signal<string | null> = this.roomStore.roomError;
  readonly focusStageTick: Signal<number> = this.roomStore.focusStageTick;

  readonly effectiveRoomTitle: Signal<string> = this.stageStore.effectiveRoomTitle;
  readonly effectiveRoomTopic: Signal<string> = this.roomStore.effectiveRoomTopic;
  readonly practiseLangLabel: Signal<string> = this.stageStore.practiseLangLabel;
  readonly hostName: Signal<string> = this.stageStore.hostName;
  readonly participantCount: Signal<number> = computed(
    (): number => this.stageStore.room()?.participantCount ?? 0,
  );
  readonly hasOtherParticipants: Signal<boolean> = computed(() => {
    const myId = this.stageStore.currentUserId();
    return (
      this.speakers().some((s) => s.id !== myId) ||
      this.listeners().some((l) => l.id !== myId) ||
      this.participantCount() > 1
    );
  });
  readonly handCount: Signal<number> = computed(
    (): number =>
      this.stageStore.stage().speakers.length > 0
        ? this.stageStore.stage().handRaiseQueue.length
        : (this.stageStore.room()?.handRaiseCount ?? 0),
  );
  readonly isHost: Signal<boolean> = this.stageStore.isHost;
  readonly pendingRequests = this.stageStore.pendingRequests;

  readonly audioStatus: Signal<LiveKitConnectionStatus> = this.roomStore.audio.status;
  readonly audioFailed: Signal<boolean> = computed((): boolean => this.audioStatus() === 'failed');
  readonly noiseIsolationEnabled: Signal<boolean> = this.roomStore.audio.noiseIsolationEnabled;
  readonly noiseIsolationMode: Signal<NoiseIsolationMode> = this.roomStore.audio.noiseIsolationMode;
  readonly audioInputDevices: Signal<readonly AudioDeviceOption[]> =
    this.roomStore.audio.audioInputDevices;
  readonly selectedAudioInputId: Signal<string | null> = this.roomStore.audio.selectedAudioInputId;
  readonly soundBlocked: Signal<boolean> = this.roomStore.audio.soundBlocked;
  readonly micError: Signal<string | null> = this.roomStore.audio.micError;
  readonly muted: Signal<boolean> = this.roomStore.muted;
  readonly canUseMic: Signal<boolean> = this.roomStore.audio.canPublish;
  readonly mutedByHost: Signal<boolean> = computed(
    (): boolean =>
      this.roomStore.audio.isMutedByHost() ||
      (this.stageStore.isCurrentUserOnStage() &&
        this.audioStatus() === 'connected' &&
        !this.canUseMic()),
  );

  readonly speakers: Signal<readonly RoomSpeaker[]> = this.stageStore.speakers;
  readonly effectiveMaxSeats: Signal<number> = this.stageStore.effectiveMaxSeats;
  readonly stageReactions: Signal<readonly StageReaction[]> = this.stageStore.stageReactions;
  readonly stageReaction: Signal<StageReaction | null> = this.stageStore.stageReaction;
  readonly stageReactionKey: Signal<number> = this.stageStore.stageReactionKey;
  readonly speakerReactions: Signal<ReadonlyMap<string, string>> = this.stageStore.speakerReactions;
  readonly idleWarning: Signal<boolean> = this.stageStore.idleWarning;
  readonly hostReconnecting: Signal<boolean> = this.stageStore.hostReconnecting;
  readonly canClaimStageSeat: Signal<boolean> = this.stageStore.canClaimStageSeat;
  readonly claimingSeat: Signal<boolean> = this.stageStore.claimingSeat;
  readonly togglingHand: Signal<boolean> = this.stageStore.togglingHand;
  readonly handRaised: Signal<boolean> = this.stageStore.handRaised;
  readonly canLeaveStage: Signal<boolean> = computed(
    (): boolean => this.stageStore.isCurrentUserOnStage() && !this.stageStore.isHost(),
  );
  readonly canRaiseHand: Signal<boolean> = computed(
    (): boolean => !this.stageStore.isCurrentUserOnStage(),
  );

  readonly listeners: Signal<readonly RoomListener[]> = this.stageStore.listeners;
  readonly audienceCount: Signal<number> = this.stageStore.audienceCount;
  readonly hasMoreAudience: Signal<boolean> = this.stageStore.hasMoreAudience;
  readonly audienceLoading: Signal<boolean> = this.stageStore.audienceLoading;

  readonly messages: Signal<readonly DiscussionMessage[]> = this.chatStore.messages;
  readonly commentCountLabel: Signal<string> = this.chatStore.commentCountLabel;
  readonly messagesLoading: Signal<boolean> = this.roomStore.messagesLoading;
  readonly chatError: Signal<boolean> = this.chatStore.chatError;
  readonly replyTarget: Signal<string | null> = this.chatStore.replyTarget;
  readonly correcting: Signal<boolean> = this.chatStore.correcting;
  readonly pinnedTopic: Signal<string | null> = this.chatStore.pinnedTopic;
  readonly pinnedMessage: Signal<DiscussionMessage | null> = this.chatStore.pinnedMessage;
  readonly pinnedMessageId: Signal<string | null> = this.chatStore.pinnedCommentId;
  readonly chatMutedUsers: Signal<ReadonlySet<string>> = this.chatStore.chatMutedUsers;
  readonly canSendMessage: Signal<boolean> = computed((): boolean => !this.chatStore.isChatMuted());

  constructor() {
    effect(() => {
      const state = this.roomStore.connectionState();
      if (state.status === 'ended' || state.status === 'kicked') {
        untracked(() => {
          this.leavingRoomState.set(true);
          this.toast.show(state.message || 'Room closed.');
          void this.router.navigate(['/rooms']);
        });
      }
    });
  }

  enterRoom(roomId: string): void {
    this.leavingRoomState.set(false);
    this.roomStore.enterRoom(roomId);
  }

  retryJoin(roomId: string): void {
    this.leavingRoomState.set(false);
    this.roomStore.enterRoom(roomId);
  }

  syncPageTitle(activeRoomId: string): void {
    this.titleStrategy.setPageTitle(
      this.roomStore.roomId() === activeRoomId ? this.stageStore.effectiveRoomTitle() : 'Live room',
    );
  }

  editRoomData(): Required<UpdateVoiceRoomPayload> {
    return {
      title: this.stageStore.effectiveRoomTitle(),
      topic: this.stageStore.room()?.topic ?? '',
      maxStageSeats: this.stageStore.effectiveMaxSeats(),
    };
  }

  navigateTo(path: string): void {
    void this.router.navigate([path]);
  }

  notify(message: string): void {
    this.toast.show(message);
  }

  copyRoomLink(): void {
    if (typeof navigator === 'undefined' || !navigator.clipboard || typeof window === 'undefined') {
      this.toast.show('Copy the room URL from your address bar.');
      return;
    }
    this.writeClipboardText(
      window.location.href,
      () => this.toast.show('Room link copied.'),
      () => this.toast.show('Could not copy room link.'),
    );
  }

  toggleNoiseIsolation(): void {
    this.roomStore.audio.toggleNoise((mode) => {
      if (this.destroyRef.destroyed) return;
      if (mode === 'krisp-active') {
        this.toast.show('Noise isolation enabled.');
      } else if (mode === 'krisp-bypassed') {
        this.toast.show('Noise isolation paused.');
      } else {
        this.toast.show('Using standard noise reduction.');
      }
    });
  }

  selectAudioDevice(deviceId: string): void {
    this.roomStore.audio.selectInputDevice(deviceId, (ok) => {
      if (!this.destroyRef.destroyed) {
        this.toast.show(ok ? 'Microphone switched.' : 'Could not switch microphone.');
      }
    });
  }

  refreshAudioDevices(): void {
    this.roomStore.audio.refreshAudioInputDevices();
  }

  reconnectAudio(roomId: string): void {
    if (this.reconnectingAudioState()) return;
    this.reconnectingAudioState.set(true);
    this.roomStore.reconnectAudio((res) => {
      this.reconnectingAudioState.set(false);
      this.handleFeedback(roomId, res, 'Audio reconnected.');
    });
  }

  enableAudio(): void {
    this.roomStore.audio.enableAudioPlayback((ok) => {
      if (!this.destroyRef.destroyed) {
        this.toast.show(ok ? 'Room audio enabled.' : 'Could not start audio playback.');
      }
    });
  }

  stayLive(roomId: string): void {
    this.roomStore.stayLive(roomId);
  }

  updateRoom(roomId: string, payload: UpdateVoiceRoomPayload): void {
    this.roomStore.updateRoom(payload, (res) => this.handleFeedback(roomId, res, 'Room updated.'));
  }

  saveRoomSettings(roomId: string, payload: UpdateVoiceRoomPayload): Promise<string | null> {
    return new Promise((resolve) => {
      this.roomStore.updateRoom(payload, (res) => {
        if (res.ok) {
          this.handleFeedback(roomId, res, 'Room updated.');
          resolve(null);
          return;
        }
        resolve(res.message ?? 'Could not update room.');
      });
    });
  }

  endRoom(roomId: string): void {
    this.leavingRoomState.set(true);
    this.roomStore.endRoom((res) => {
      if (this.handleFeedback(roomId, res, 'Room ended.')) {
        void this.router.navigate(['/rooms']);
        return;
      }
      this.leavingRoomState.set(false);
    });
  }

  loadProfilePreview(
    id: string,
    target: ProfilePreviewTarget,
    onReady: (data: HostProfileDialogData) => void,
  ): void {
    const seq = ++this.profilePreviewSeq;
    this.usersApi.getUser(id, 'socialStats').subscribe({
      next: (profile) => {
        if (this.destroyRef.destroyed || seq !== this.profilePreviewSeq) return;
        const isYou = id === this.stageStore.currentUserId();
        const stats = profile.socialStats ?? {
          followerCount: 0,
          followingCount: 0,
          followedByMe: false,
          followsMe: false,
        };
        onReady({
          profile,
          stats,
          target,
          isYou,
          onToggleFollow: isYou
            ? undefined
            : (follow) => this.toggleFollowUser(profile, follow),
        });
      },
      error: (err: unknown) => {
        if (!this.destroyRef.destroyed && seq === this.profilePreviewSeq) {
          this.toast.show(errorMessage(err, 'Could not load this profile.'));
        }
      },
    });
  }

  private async toggleFollowUser(profile: UserProfileResponse, follow: boolean): Promise<boolean> {
    try {
      await firstValueFrom(
        follow ? this.usersApi.follow(profile.id) : this.usersApi.unfollow(profile.id),
      );
      this.identity?.refreshSocialStats();
      if (!this.destroyRef.destroyed) {
        this.toast.show(
          follow ? `Following ${profile.displayName}.` : `Unfollowed ${profile.displayName}.`,
        );
      }
      return true;
    } catch (err: unknown) {
      if (!this.destroyRef.destroyed) {
        this.toast.show(errorMessage(err, 'Could not update follow status.'));
      }
      return false;
    }
  }

  speakerAction(
    roomId: string,
    event: { action: SpeakerMenuAction; speaker: RoomSpeaker },
    onOpenProfile: (id: string, target: ProfilePreviewTarget) => void,
  ): void {
    const { action, speaker } = event;
    if (action === 'profile') {
      onOpenProfile(speaker.id, { kind: speaker.role, muted: speaker.muted });
      return;
    }

    switch (action) {
      case 'mute':
        if (speaker.isYou) {
          this.toggleMute(roomId);
        } else {
          this.stageStore.runRoomCommand(
            (id) => this.voiceRoomApi.muteSpeaker(id, speaker.id),
            'Could not mute speaker.',
            undefined,
            (res) => this.handleFeedback(roomId, res, `Muted ${speaker.name}.`),
          );
        }
        return;
      case 'leave-stage':
        this.leaveStage(roomId);
        return;
      case 'audience':
        this.stageStore.runRoomCommand(
          (id) => this.voiceRoomApi.demoteSpeaker(id, speaker.id),
          'Could not move speaker to audience.',
          undefined,
          (res) => this.handleFeedback(roomId, res, `${speaker.name} moved to audience.`),
        );
        return;
      case 'remove':
        this.stageStore.runRoomCommand(
          (id) => this.voiceRoomApi.kickParticipant(id, speaker.id),
          'Could not remove participant.',
          undefined,
          (res) => this.handleFeedback(roomId, res, `${speaker.name} removed from the room.`),
        );
        return;
      case 'transfer-host':
        this.stageStore.runRoomCommand(
          (id) => this.voiceRoomApi.transferHost(id, speaker.id),
          'Could not transfer host role.',
          undefined,
          (res) => this.handleFeedback(roomId, res, `Host role transferred to ${speaker.name}.`),
        );
        return;
      default:
        return;
    }
  }

  listenerAction(
    roomId: string,
    event: { action: ListenerMenuAction; listener: RoomListener },
    onOpenProfile: (id: string, target: ProfilePreviewTarget) => void,
  ): void {
    const { action, listener } = event;
    if (action === 'profile') {
      onOpenProfile(listener.id, { kind: 'listener' });
      return;
    }

    switch (action) {
      case 'stage':
      case 'approve':
        this.stageStore.runRoomCommand(
          (id) => this.voiceRoomApi.promoteSpeaker(id, listener.id),
          'Could not promote to stage.',
          undefined,
          (res) => this.handleFeedback(roomId, res, `${listener.name} moved to stage.`),
        );
        return;
      case 'transfer-host':
        this.stageStore.runRoomCommand(
          (id) => this.voiceRoomApi.transferHost(id, listener.id),
          'Could not transfer host role.',
          undefined,
          (res) => this.handleFeedback(roomId, res, `Host role transferred to ${listener.name}.`),
        );
        return;
      case 'remove':
        this.stageStore.runRoomCommand(
          (id) => this.voiceRoomApi.kickParticipant(id, listener.id),
          'Could not remove participant.',
          undefined,
          (res) => this.handleFeedback(roomId, res, `${listener.name} removed from room.`),
        );
        return;
      default:
        return;
    }
  }

  toggleMute(roomId: string): void {
    this.roomStore.toggleSelfMic((res) => this.handleFeedback(roomId, res));
  }

  toggleHand(roomId: string): void {
    this.stageStore.toggleHandRaised((res) => this.handleFeedback(roomId, res));
  }

  claimStageSeat(roomId: string): void {
    this.stageStore.claimStageSeat((res) => this.handleFeedback(roomId, res, 'Joined the stage.'));
  }

  leaveStage(roomId: string): void {
    this.stageStore.leaveStage((res) => this.handleFeedback(roomId, res, 'Returned to audience.'));
  }

  approveRequest(roomId: string, targetId: string): void {
    this.stageStore.runRoomCommand(
      (id) => this.voiceRoomApi.promoteSpeaker(id, targetId),
      'Could not promote to stage.',
      undefined,
      (res) => this.handleFeedback(roomId, res, 'Promoted to stage.'),
    );
  }

  sendStageReaction(roomId: string, reaction: BackendReaction): void {
    this.stageStore.runRoomCommand(
      (id) => this.voiceRoomApi.sendReaction(id, reaction),
      'Could not send reaction.',
      undefined,
      (res) => this.handleFeedback(roomId, res),
    );
  }

  loadMoreAudience(roomId: string): void {
    this.stageStore.loadMoreAudience((res) => this.handleFeedback(roomId, res));
  }

  updateChatTopic(roomId: string, text: string): void {
    this.chatStore.setChatTopic(text, (res) =>
      this.handleFeedback(roomId, res, 'Chat topic updated.'),
    );
  }

  retryChat(onDone?: (ok: boolean) => void): void {
    this.chatStore.reloadMessages((ok) => {
      if (ok && !this.destroyRef.destroyed) {
        this.toast.show('Chat loaded.');
      }
      onDone?.(ok);
    });
  }

  refreshChat(): void {
    this.chatStore.reloadMessages((ok) => {
      if (ok && !this.destroyRef.destroyed) {
        this.toast.show('Chat updated.');
      }
    });
  }

  clearReplyTarget(): void {
    this.chatStore.setReplyTarget(null);
  }

  sendMessage(roomId: string, text: string, onSent?: () => void): void {
    if (this.sendingCommentState()) return;
    this.sendingCommentState.set(true);
    this.chatStore.sendMessage(text, (res) => {
      this.sendingCommentState.set(false);
      if (this.handleFeedback(roomId, res)) {
        onSent?.();
      }
    });
  }

  toggleMessageReaction(roomId: string, messageId: string, reaction: BackendReaction): void {
    this.chatStore.toggleReaction(messageId, reaction, (res) => this.handleFeedback(roomId, res));
  }

  commentAction(
    roomId: string,
    event: {
      action: 'reply' | 'pin' | 'copy' | 'correct' | 'mute' | 'delete';
      message: DiscussionMessage;
    },
  ): void {
    const { action, message } = event;
    switch (action) {
      case 'correct': {
        const original = this.chatStore.rawComments().find((c) => c.id === message.id);
        if (original) this.chatStore.setReplyTarget(message.author, original.id, original.content);
        return;
      }
      case 'reply':
        this.chatStore.setReplyTarget(message.author, message.id);
        return;
      case 'pin':
        if (this.chatStore.pinnedCommentId() === message.id) {
          this.unpinMessage(roomId);
        } else {
          this.chatStore.pinMessage(message.id, (res) =>
            this.handleFeedback(roomId, res, 'Pinned comment.'),
          );
        }
        return;
      case 'copy':
        if (typeof navigator === 'undefined' || !navigator.clipboard) {
          this.toast.show('Could not copy this comment.');
          return;
        }
        this.writeClipboardText(
          message.text,
          () => this.toast.show('Copied.'),
          () => this.toast.show('Could not copy this comment.'),
        );
        return;
      case 'mute':
        if (message.authorId) {
          this.chatStore.muteChatUser(message.authorId, (res) =>
            this.handleFeedback(roomId, res, `Updated chat mute for ${message.author}.`),
          );
        }
        return;
      case 'delete':
        this.chatStore.deleteMessage(message.id, (res) =>
          this.handleFeedback(roomId, res, 'Deleted.'),
        );
        return;
      default:
        return;
    }
  }

  unpinMessage(roomId: string): void {
    this.chatStore.pinMessage(null, (res) => this.handleFeedback(roomId, res, 'Unpinned.'));
  }

  leaveQuietly(roomId: string): void {
    this.leavingRoomState.set(true);
    this.roomStore.leaveRoom((res) => {
      this.handleFeedback(roomId, res, 'Left the room.');
      if (!this.destroyRef.destroyed && this.roomStore.roomId() !== roomId) {
        void this.router.navigate(['/rooms']);
        return;
      }
      this.leavingRoomState.set(false);
    });
  }

  private handleFeedback(roomId: string, res: ActionFeedback, successMessage?: string): boolean {
    if (this.destroyRef.destroyed) return false;
    const active = this.roomStore.roomId();
    if (active !== null && active !== roomId) return false;
    if (res.ok) {
      if (successMessage) {
        this.toast.show(successMessage);
      }
      return true;
    }
    this.toast.show(res.message ?? 'Action could not be completed.');
    return false;
  }

  private writeClipboardText(text: string, onSuccess: () => void, onError: () => void): void {
    void navigator.clipboard.writeText(text).then(
      () => {
        if (!this.destroyRef.destroyed) onSuccess();
      },
      () => {
        if (!this.destroyRef.destroyed) onError();
      },
    );
  }
}
