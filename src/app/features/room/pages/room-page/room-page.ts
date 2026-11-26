import {
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { UsersApi } from '../../../../core/auth/users-api';
import { errorMessage } from '../../../../core/http/http-error.interceptor';
import { AppTitleStrategy } from '../../../../core/routing/app-title-strategy';
import { ToastNotifier } from '../../../../core/services/toast-notifier';
import { BackendReaction, UpdateVoiceRoomPayload } from '../../../../shared/models/voice-room.model';
import { SkeletonLoader } from '../../../../shared/ui/skeleton-loader/skeleton-loader';
import { KEYBOARD_OFFSET_THRESHOLD_PX } from '../../constants/room.constants';
import { VoiceRoomApi } from '../../data-access/voice-room-api';
import {
  DiscussionMessage,
  ProfilePreviewTarget,
  RoomListener,
  RoomSpeaker,
} from '../../models/live-room.model';
import { ActionFeedback, LiveRoomStore } from '../../store/live-room-store';
import { RoomChatStore } from '../../store/room-chat-store';
import { RoomStageStore } from '../../store/room-stage-store';
import { EditRoomDialog } from '../../ui/edit-room-dialog/edit-room-dialog';
import { EndRoomDialog } from '../../ui/end-room-dialog/end-room-dialog';
import {
  HostProfileDialog,
  HostProfileDialogData,
} from '../../ui/host-profile-dialog/host-profile-dialog';
import { ListenerMenuAction, RoomAudience } from '../../ui/room-audience/room-audience';
import { RoomControls } from '../../ui/room-controls/room-controls';
import { RoomDiscussion } from '../../ui/room-discussion/room-discussion';
import { RoomStage, SpeakerMenuAction } from '../../ui/room-stage/room-stage';
import { RoomToolbar } from '../../ui/room-toolbar/room-toolbar';

@Component({
  selector: 'app-room-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    RoomToolbar,
    RoomStage,
    RoomAudience,
    RoomControls,
    RoomDiscussion,
    SkeletonLoader,
  ],
  templateUrl: './room-page.html',
  styleUrl: './room-page.scss',
})
export class RoomPage {
  readonly id = input.required<string>();

  readonly roomStore = inject(LiveRoomStore);
  readonly stageStore = inject(RoomStageStore);
  readonly chatStore = inject(RoomChatStore);
  readonly toast = inject(ToastNotifier);
  private readonly voiceRoomApi = inject(VoiceRoomApi);
  private readonly usersApi = inject(UsersApi);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly titleStrategy = inject(AppTitleStrategy);
  private readonly roomStageRef = viewChild<RoomStage>('roomStage');
  private readonly discussion = viewChild(RoomDiscussion);

  private profilePreviewSeq = 0;

  readonly sendingComment = signal(false);
  readonly keyboardOffset = signal(0);
  private lastFocusTick = this.roomStore.focusStageTick();
  readonly isCurrentRoom = computed(() => this.roomStore.roomId() === this.id());

  readonly isHost = this.stageStore.isHost;
  readonly canUseMic = this.roomStore.audio.canPublish;
  readonly canLeaveStage = computed(
    () => this.stageStore.isCurrentUserOnStage() && !this.stageStore.isHost(),
  );
  readonly canRaiseHand = computed(() => !this.stageStore.isCurrentUserOnStage());
  readonly canSendMessage = computed(() => !this.chatStore.isChatMuted());

  constructor() {
    effect(() => {
      const roomId = this.id();
      untracked(() => void this.roomStore.enterRoom(roomId));
    });

    effect(() => {
      this.titleStrategy.setPageTitle(
        this.isCurrentRoom() ? this.stageStore.effectiveRoomTitle() : 'Live room',
      );
    });

    afterNextRender(() => {
      this.bindVisualViewportKeyboard();
    });

    afterRenderEffect({
      write: () => {
        const tick = this.roomStore.focusStageTick();
        const stage = this.roomStageRef();
        if (stage && tick > this.lastFocusTick) {
          this.lastFocusTick = tick;
          stage.focusStage();
        }
      },
    });

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

  navigateTo(path: string): void {
    void this.router.navigate([path]);
  }

  onCopyRoomLink(): void {
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

  onToggleNoiseIsolation(): void {
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

  onSelectAudioDevice(deviceId: string): void {
    this.roomStore.audio.selectInputDevice(deviceId, (ok) => {
      if (!this.destroyRef.destroyed) {
        this.toast.show(ok ? 'Microphone switched.' : 'Could not switch microphone.');
      }
    });
  }

  onReconnectAudio(): void {
    const roomId = this.id();
    this.roomStore.reconnectAudio((res) =>
      this.handleFeedback(roomId, res, 'Audio reconnected.'),
    );
  }

  onEnableAudio(): void {
    this.roomStore.audio.enableAudioPlayback((ok) => {
      if (!this.destroyRef.destroyed) {
        this.toast.show(ok ? 'Room audio enabled.' : 'Could not start audio playback.');
      }
    });
  }

  openEditRoomDialog(): void {
    const roomId = this.id();
    const ref = this.dialog.open<
      EditRoomDialog,
      Required<UpdateVoiceRoomPayload>,
      UpdateVoiceRoomPayload
    >(EditRoomDialog, {
      width: '440px',
      maxWidth: 'calc(100vw - 24px)',
      data: {
        title: this.stageStore.effectiveRoomTitle(),
        topic: this.stageStore.room()?.topic ?? '',
        maxStageSeats: this.stageStore.effectiveMaxSeats(),
      },
    });

    ref.afterClosed().subscribe((result) => {
      if (!result || this.destroyRef.destroyed || this.id() !== roomId || !this.isCurrentRoom()) {
        return;
      }
      this.roomStore.updateRoom(result, (res) =>
        this.handleFeedback(roomId, res, 'Room updated.'),
      );
    });
  }

  openEndRoomDialog(): void {
    const roomId = this.id();
    const ref = this.dialog.open<EndRoomDialog, void, boolean>(EndRoomDialog, {
      width: '440px',
      maxWidth: 'calc(100vw - 24px)',
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed || this.destroyRef.destroyed || this.id() !== roomId || !this.isCurrentRoom()) {
        return;
      }
      this.roomStore.endRoom((res) => {
        if (this.handleFeedback(roomId, res, 'Room ended.')) {
          void this.router.navigate(['/rooms']);
        }
      });
    });
  }

  openProfilePreview(target: ProfilePreviewTarget, id: string): void {
    const seq = ++this.profilePreviewSeq;
    forkJoin([this.usersApi.getUser(id), this.usersApi.getSocialStats(id)]).subscribe({
      next: ([profile, stats]) => {
        if (this.destroyRef.destroyed || seq !== this.profilePreviewSeq) return;
        const isYou = id === this.stageStore.currentUserId();
        const ref = this.dialog.open<HostProfileDialog, HostProfileDialogData, string>(
          HostProfileDialog,
          {
            width: '560px',
            maxWidth: 'calc(100vw - 24px)',
            data: { profile, stats, target, isYou },
          },
        );
        ref.afterClosed().subscribe((action) => {
          if (!this.destroyRef.destroyed && isYou && action === 'view-profile') {
            void this.router.navigate(['/profile']);
          }
        });
      },
      error: (err: unknown) => {
        if (!this.destroyRef.destroyed && seq === this.profilePreviewSeq) {
          this.toast.show(errorMessage(err, 'Could not load this profile.'));
        }
      },
    });
  }

  onSpeakerAction(event: { action: SpeakerMenuAction; speaker: RoomSpeaker }): void {
    const { action, speaker } = event;
    if (action === 'profile') {
      this.openProfilePreview({ kind: speaker.role, muted: speaker.muted }, speaker.id);
      return;
    }

    const roomId = this.id();
    switch (action) {
      case 'mute':
        if (speaker.isYou) {
          this.onToggleMute();
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
        this.onLeaveStage();
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

  onToggleMute(): void {
    const roomId = this.id();
    this.roomStore.toggleSelfMic((res) => this.handleFeedback(roomId, res));
  }

  onToggleHand(): void {
    const roomId = this.id();
    this.stageStore.toggleHandRaised((res) => this.handleFeedback(roomId, res));
  }

  onClaimStageSeat(): void {
    const roomId = this.id();
    this.stageStore.claimStageSeat((res) =>
      this.handleFeedback(roomId, res, 'Joined the stage.'),
    );
  }

  onLeaveStage(): void {
    const roomId = this.id();
    this.stageStore.leaveStage((res) =>
      this.handleFeedback(roomId, res, 'Returned to audience.'),
    );
  }

  onApproveRequest(targetId: string): void {
    const roomId = this.id();
    this.stageStore.runRoomCommand(
      (id) => this.voiceRoomApi.promoteSpeaker(id, targetId),
      'Could not promote to stage.',
      undefined,
      (res) => this.handleFeedback(roomId, res, 'Promoted to stage.'),
    );
  }

  onStageReaction(reaction: BackendReaction): void {
    const roomId = this.id();
    this.stageStore.runRoomCommand(
      (id) => this.voiceRoomApi.sendReaction(id, reaction),
      'Could not send reaction.',
      undefined,
      (res) => this.handleFeedback(roomId, res),
    );
  }

  onListenerAction(event: {
    action: ListenerMenuAction;
    listener: RoomListener;
  }): void {
    const { action, listener } = event;
    if (action === 'profile') {
      this.openProfilePreview({ kind: 'listener' }, listener.id);
      return;
    }

    const roomId = this.id();
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

  onLoadMoreAudience(): void {
    const roomId = this.id();
    this.stageStore.loadMoreAudience((res) => this.handleFeedback(roomId, res));
  }

  onChatTopic(text: string): void {
    const roomId = this.id();
    this.chatStore.setChatTopic(text, (res) =>
      this.handleFeedback(roomId, res, 'Chat topic updated.'),
    );
  }

  onRetryChat(): void {
    this.chatStore.reloadMessages((ok) => {
      if (ok && !this.destroyRef.destroyed) {
        this.toast.show('Chat loaded.');
      }
    });
  }

  onRefreshChat(): void {
    this.chatStore.reloadMessages((ok) => {
      if (ok && !this.destroyRef.destroyed) {
        this.toast.show('Chat updated.');
      }
    });
  }

  onSendMessage(text: string): void {
    if (this.sendingComment()) return;
    const roomId = this.id();
    const discussion = this.discussion();
    this.sendingComment.set(true);
    this.chatStore.sendMessage(text, (res) => {
      this.sendingComment.set(false);
      if (this.handleFeedback(roomId, res)) {
        discussion?.clearSentDraft(text);
      }
    });
  }

  onToggleMessageReaction(event: {
    messageId: string;
    reaction: BackendReaction;
  }): void {
    const roomId = this.id();
    this.chatStore.toggleReaction(event.messageId, event.reaction, (res) =>
      this.handleFeedback(roomId, res),
    );
  }

  onCommentAction(event: {
    action: 'reply' | 'pin' | 'copy' | 'correct' | 'mute' | 'delete';
    message: DiscussionMessage;
  }): void {
    const { action, message } = event;
    const roomId = this.id();
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

  onUnpinMessage(): void {
    const roomId = this.id();
    this.chatStore.pinMessage(null, (res) => this.handleFeedback(roomId, res, 'Unpinned.'));
  }

  onLeaveQuietly(): void {
    const roomId = this.id();
    this.roomStore.leaveRoom((res) => {
      this.handleFeedback(roomId, res, 'Left the room.');
      if (!this.destroyRef.destroyed && this.id() === roomId) {
        void this.router.navigate(['/rooms']);
      }
    });
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

  private handleFeedback(roomId: string, res: ActionFeedback, successMessage?: string): boolean {
    if (this.destroyRef.destroyed || this.id() !== roomId) return false;
    if (res.ok) {
      if (successMessage) {
        this.toast.show(successMessage);
      }
      return true;
    }
    this.toast.show(res.message ?? 'Action could not be completed.');
    return false;
  }

  private bindVisualViewportKeyboard(): void {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const updateOffset = () => {
      const diff = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      this.keyboardOffset.set(diff > KEYBOARD_OFFSET_THRESHOLD_PX ? Math.round(diff) : 0);
    };
    vv.addEventListener('resize', updateOffset);
    vv.addEventListener('scroll', updateOffset);
    this.destroyRef.onDestroy(() => {
      vv.removeEventListener('resize', updateOffset);
      vv.removeEventListener('scroll', updateOffset);
    });
  }
}
