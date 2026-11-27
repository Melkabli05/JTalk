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
import { forkJoin } from 'rxjs';
import { UsersApi } from '../../../core/auth/users-api';
import { errorMessage } from '../../../core/http/http-error.interceptor';
import { AppTitleStrategy } from '../../../core/routing/app-title-strategy';
import { ToastNotifier } from '../../../core/services/toast-notifier';
import type {
  BackendReaction,
  UpdateVoiceRoomPayload,
} from '../../../shared/models/voice-room.model';
import type {
  AudioDeviceOption,
  LiveKitConnectionStatus,
} from '../data-access/livekit-audio-engine';
import type { NoiseIsolationMode } from '../data-access/livekit-noise-filter';
import { VoiceRoomApi } from '../data-access/voice-room-api';
import type {
  DiscussionMessage,
  ProfilePreviewTarget,
  RoomListener,
  RoomSpeaker,
} from '../models/live-room.model';
import type { HostProfileDialogData } from '../ui/host-profile-dialog/host-profile-dialog';
import type { ListenerMenuAction } from '../ui/room-audience/room-audience';
import type { SpeakerMenuAction } from '../ui/room-stage/room-stage';
import { type ActionFeedback, LiveRoomStore } from './live-room-store';
import { RoomChatStore } from './room-chat-store';
import { RoomStageStore } from './room-stage-store';

@Service()
export class RoomFacade {
  private readonly roomStore = inject(LiveRoomStore);
  private readonly stageStore = inject(RoomStageStore);
  private readonly chatStore = inject(RoomChatStore);
  private readonly voiceRoomApi = inject(VoiceRoomApi);
  private readonly usersApi = inject(UsersApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastNotifier);
  private readonly destroyRef = inject(DestroyRef);
  private readonly titleStrategy = inject(AppTitleStrategy);

  private profilePreviewSeq = 0;

  private readonly sendingCommentState = signal(false);
  readonly sendingComment: Signal<boolean> = this.sendingCommentState.asReadonly();

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
  readonly handCount: Signal<number> = computed(
    (): number => this.stageStore.room()?.handRaiseCount ?? 0,
  );
  readonly isHost: Signal<boolean> = this.stageStore.isHost;
  readonly pendingRequests = this.stageStore.pendingRequests;

  readonly audioStatus: Signal<LiveKitConnectionStatus> = this.roomStore.audio.status;
  readonly noiseIsolationEnabled: Signal<boolean> = this.roomStore.audio.noiseIsolationEnabled;
  readonly noiseIsolationMode: Signal<NoiseIsolationMode> = this.roomStore.audio.noiseIsolationMode;
  readonly audioInputDevices: Signal<readonly AudioDeviceOption[]> =
    this.roomStore.audio.audioInputDevices;
  readonly selectedAudioInputId: Signal<string | null> =
    this.roomStore.audio.selectedAudioInputId;
  readonly soundBlocked: Signal<boolean> = this.roomStore.audio.soundBlocked;
  readonly micError: Signal<string | null> = this.roomStore.audio.micError;
  readonly muted: Signal<boolean> = this.roomStore.muted;
  readonly canUseMic: Signal<boolean> = this.roomStore.audio.canPublish;

  readonly speakers: Signal<readonly RoomSpeaker[]> = this.stageStore.speakers;
  readonly effectiveMaxSeats: Signal<number> = this.stageStore.effectiveMaxSeats;
  readonly stageReaction: Signal<string | null> = this.stageStore.stageReaction;
  readonly stageReactionKey: Signal<number> = this.stageStore.stageReactionKey;
  readonly canClaimStageSeat: Signal<boolean> = this.stageStore.canClaimStageSeat;
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
  readonly chatMutedUsers: Signal<ReadonlySet<string>> = this.chatStore.chatMutedUsers;
  readonly canSendMessage: Signal<boolean> = computed(
    (): boolean => !this.chatStore.isChatMuted(),
  );

  constructor() {
    effect(() => {
      const err = this.roomStore.roomError();
      if (err === 'This room has ended.' || err === 'You were removed from this room.') {
        untracked(() => {
          this.toast.show(err === 'This room has ended.' ? 'Room closed.' : err);
          void this.router.navigate(['/rooms']);
        });
      }
    });
  }

  enterRoom(roomId: string): void {
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
        this.toast.show('Krisp noise isolation enabled.');
      } else if (mode === 'krisp-bypassed') {
        this.toast.show('Krisp noise isolation paused.');
      } else {
        this.toast.show('Using browser WebRTC noise suppression.');
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
    this.roomStore.reconnectAudio((res) =>
      this.handleFeedback(roomId, res, 'Audio reconnected.'),
    );
  }

  enableAudio(): void {
    this.roomStore.audio.enableAudioPlayback((ok) => {
      if (!this.destroyRef.destroyed) {
        this.toast.show(ok ? 'Room audio enabled.' : 'Could not start audio playback.');
      }
    });
  }

  updateRoom(roomId: string, payload: UpdateVoiceRoomPayload): void {
    this.roomStore.updateRoom(payload, (res) =>
      this.handleFeedback(roomId, res, 'Room updated.'),
    );
  }

  endRoom(roomId: string): void {
    this.roomStore.endRoom((res) => {
      if (this.handleFeedback(roomId, res, 'Room ended.')) {
        void this.router.navigate(['/rooms']);
      }
    });
  }

  loadProfilePreview(
    id: string,
    target: ProfilePreviewTarget,
    onReady: (data: HostProfileDialogData) => void,
  ): void {
    const seq = ++this.profilePreviewSeq;
    forkJoin([this.usersApi.getUser(id), this.usersApi.getSocialStats(id)]).subscribe({
      next: ([profile, stats]) => {
        if (this.destroyRef.destroyed || seq !== this.profilePreviewSeq) return;
        const isYou = id === this.stageStore.currentUserId();
        onReady({ profile, stats, target, isYou });
      },
      error: (err: unknown) => {
        if (!this.destroyRef.destroyed && seq === this.profilePreviewSeq) {
          this.toast.show(errorMessage(err, 'Could not load this profile.'));
        }
      },
    });
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
          (res) =>
            this.handleFeedback(roomId, res, `Host role transferred to ${speaker.name}.`),
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
    this.stageStore.claimStageSeat((res) =>
      this.handleFeedback(roomId, res, 'Joined the stage.'),
    );
  }

  leaveStage(roomId: string): void {
    this.stageStore.leaveStage((res) =>
      this.handleFeedback(roomId, res, 'Returned to audience.'),
    );
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
    this.chatStore.toggleReaction(messageId, reaction, (res) =>
      this.handleFeedback(roomId, res),
    );
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
        this.chatStore.pinMessage(message.id, (res) =>
          this.handleFeedback(roomId, res, 'Pinned comment.'),
        );
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
    this.roomStore.leaveRoom((res) => {
      this.handleFeedback(roomId, res, 'Left the room.');
      if (!this.destroyRef.destroyed && this.roomStore.roomId() !== roomId) {
        void this.router.navigate(['/rooms']);
      }
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
