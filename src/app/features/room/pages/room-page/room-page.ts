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
import { forkJoin, lastValueFrom } from 'rxjs';
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

  async onCopyRoomLink(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.clipboard || typeof window === 'undefined') {
      this.toast.show('Copy the room URL from your address bar.');
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.toast.show('Room link copied.');
    } catch {
      this.toast.show('Could not copy room link.');
    }
  }

  async onToggleNoiseIsolation(): Promise<void> {
    const mode = await this.roomStore.audio.toggleNoiseIsolation();
    if (mode === 'krisp-active') {
      this.toast.show('Krisp noise isolation enabled.');
    } else if (mode === 'krisp-bypassed') {
      this.toast.show('Krisp noise isolation paused.');
    } else {
      this.toast.show('Using browser WebRTC noise suppression.');
    }
  }

  async onSelectAudioDevice(deviceId: string): Promise<void> {
    const ok = await this.roomStore.audio.selectAudioInputDevice(deviceId);
    this.toast.show(ok ? 'Microphone switched.' : 'Could not switch microphone.');
  }

  async onReconnectAudio(): Promise<void> {
    const roomId = this.id();
    this.handleFeedback(roomId, await this.roomStore.reconnectAudio(), 'Audio reconnected.');
  }

  async onEnableAudio(): Promise<void> {
    const ok = await this.roomStore.audio.enableAudio();
    this.toast.show(ok ? 'Room audio enabled.' : 'Could not start audio playback.');
  }

  async openEditRoomDialog(): Promise<void> {
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

    const result = await lastValueFrom(ref.afterClosed());
    if (!result || this.destroyRef.destroyed || this.id() !== roomId || !this.isCurrentRoom()) {
      return;
    }
    this.handleFeedback(roomId, await this.roomStore.updateRoom(result), 'Room updated.');
  }

  async openEndRoomDialog(): Promise<void> {
    const roomId = this.id();
    const ref = this.dialog.open<EndRoomDialog, void, boolean>(EndRoomDialog, {
      width: '440px',
      maxWidth: 'calc(100vw - 24px)',
    });

    const confirmed = await lastValueFrom(ref.afterClosed());
    if (!confirmed || this.destroyRef.destroyed || this.id() !== roomId || !this.isCurrentRoom()) {
      return;
    }
    if (this.handleFeedback(roomId, await this.roomStore.endRoom(), 'Room ended.')) {
      void this.router.navigate(['/rooms']);
    }
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

  async onSpeakerAction(event: { action: SpeakerMenuAction; speaker: RoomSpeaker }): Promise<void> {
    const { action, speaker } = event;
    if (action === 'profile') {
      void this.openProfilePreview({ kind: speaker.role, muted: speaker.muted }, speaker.id);
      return;
    }

    const roomId = this.id();
    switch (action) {
      case 'mute':
        if (speaker.isYou) {
          await this.onToggleMute();
        } else {
          this.handleFeedback(
            roomId,
            await this.stageStore.runRoomCommand(
              (id) => this.voiceRoomApi.muteSpeaker(id, speaker.id),
              'Could not mute speaker.',
            ),
            `Muted ${speaker.name}.`,
          );
        }
        return;
      case 'leave-stage':
        await this.onLeaveStage();
        return;
      case 'audience':
        this.handleFeedback(
          roomId,
          await this.stageStore.runRoomCommand(
            (id) => this.voiceRoomApi.demoteSpeaker(id, speaker.id),
            'Could not move speaker to audience.',
          ),
          `${speaker.name} moved to audience.`,
        );
        return;
      case 'remove':
        this.handleFeedback(
          roomId,
          await this.stageStore.runRoomCommand(
            (id) => this.voiceRoomApi.kickParticipant(id, speaker.id),
            'Could not remove participant.',
          ),
          `${speaker.name} removed from the room.`,
        );
        return;
      case 'transfer-host':
        this.handleFeedback(
          roomId,
          await this.stageStore.runRoomCommand(
            (id) => this.voiceRoomApi.transferHost(id, speaker.id),
            'Could not transfer host role.',
          ),
          `Host role transferred to ${speaker.name}.`,
        );
        return;
      default:
        return;
    }
  }

  async onToggleMute(): Promise<void> {
    const roomId = this.id();
    this.handleFeedback(roomId, await this.roomStore.toggleSelfMic());
  }

  async onToggleHand(): Promise<void> {
    const roomId = this.id();
    this.handleFeedback(roomId, await this.stageStore.toggleHandRaised());
  }

  async onClaimStageSeat(): Promise<void> {
    const roomId = this.id();
    this.handleFeedback(roomId, await this.stageStore.claimStageSeat(), 'Joined the stage.');
  }

  async onLeaveStage(): Promise<void> {
    const roomId = this.id();
    this.handleFeedback(roomId, await this.stageStore.leaveStage(), 'Returned to audience.');
  }

  async onApproveRequest(targetId: string): Promise<void> {
    const roomId = this.id();
    this.handleFeedback(
      roomId,
      await this.stageStore.runRoomCommand(
        (id) => this.voiceRoomApi.promoteSpeaker(id, targetId),
        'Could not promote to stage.',
      ),
      'Promoted to stage.',
    );
  }

  async onStageReaction(reaction: BackendReaction): Promise<void> {
    const roomId = this.id();
    this.handleFeedback(
      roomId,
      await this.stageStore.runRoomCommand(
        (id) => this.voiceRoomApi.sendReaction(id, reaction),
        'Could not send reaction.',
      ),
    );
  }

  async onListenerAction(event: {
    action: ListenerMenuAction;
    listener: RoomListener;
  }): Promise<void> {
    const { action, listener } = event;
    if (action === 'profile') {
      void this.openProfilePreview({ kind: 'listener' }, listener.id);
      return;
    }

    const roomId = this.id();
    switch (action) {
      case 'stage':
      case 'approve':
        this.handleFeedback(
          roomId,
          await this.stageStore.runRoomCommand(
            (id) => this.voiceRoomApi.promoteSpeaker(id, listener.id),
            'Could not promote to stage.',
          ),
          `${listener.name} moved to stage.`,
        );
        return;
      case 'remove':
        this.handleFeedback(
          roomId,
          await this.stageStore.runRoomCommand(
            (id) => this.voiceRoomApi.kickParticipant(id, listener.id),
            'Could not remove participant.',
          ),
          `${listener.name} removed from room.`,
        );
        return;
      default:
        return;
    }
  }

  async onLoadMoreAudience(): Promise<void> {
    const roomId = this.id();
    this.handleFeedback(roomId, await this.stageStore.loadMoreAudience());
  }

  async onChatTopic(text: string): Promise<void> {
    const roomId = this.id();
    this.handleFeedback(roomId, await this.chatStore.setChatTopic(text), 'Chat topic updated.');
  }

  async onRetryChat(): Promise<void> {
    if ((await this.chatStore.reloadMessages()) && !this.destroyRef.destroyed) {
      this.toast.show('Chat loaded.');
    }
  }

  async onRefreshChat(): Promise<void> {
    if ((await this.chatStore.reloadMessages()) && !this.destroyRef.destroyed) {
      this.toast.show('Chat updated.');
    }
  }

  async onSendMessage(text: string): Promise<void> {
    if (this.sendingComment()) return;
    const roomId = this.id();
    const discussion = this.discussion();
    this.sendingComment.set(true);
    try {
      if (this.handleFeedback(roomId, await this.chatStore.sendMessage(text))) {
        discussion?.clearSentDraft(text);
      }
    } finally {
      this.sendingComment.set(false);
    }
  }

  async onToggleMessageReaction(event: {
    messageId: string;
    reaction: BackendReaction;
  }): Promise<void> {
    const roomId = this.id();
    this.handleFeedback(
      roomId,
      await this.chatStore.toggleReaction(event.messageId, event.reaction),
    );
  }

  async onCommentAction(event: {
    action: 'reply' | 'pin' | 'copy' | 'correct' | 'mute' | 'delete';
    message: DiscussionMessage;
  }): Promise<void> {
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
        this.handleFeedback(roomId, await this.chatStore.pinMessage(message.id), 'Pinned comment.');
        return;
      case 'copy':
        try {
          await navigator.clipboard.writeText(message.text);
          this.toast.show('Copied.');
        } catch {
          this.toast.show('Could not copy this comment.');
        }
        return;
      case 'mute':
        if (message.authorId) {
          this.handleFeedback(
            roomId,
            await this.chatStore.muteChatUser(message.authorId),
            `Updated chat mute for ${message.author}.`,
          );
        }
        return;
      case 'delete':
        this.handleFeedback(roomId, await this.chatStore.deleteMessage(message.id), 'Deleted.');
        return;
      default:
        return;
    }
  }

  async onUnpinMessage(): Promise<void> {
    const roomId = this.id();
    this.handleFeedback(roomId, await this.chatStore.pinMessage(null), 'Unpinned.');
  }

  async onLeaveQuietly(): Promise<void> {
    const roomId = this.id();
    this.handleFeedback(roomId, await this.roomStore.leaveRoom(), 'Left the room.');
    if (!this.destroyRef.destroyed && this.id() === roomId) {
      void this.router.navigate(['/rooms']);
    }
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
