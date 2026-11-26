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
import { lastValueFrom } from 'rxjs';
import { UsersApi } from '../../../../core/auth/users-api';
import { errorMessage } from '../../../../core/http/http-error.interceptor';
import { AppTitleStrategy } from '../../../../core/routing/app-title-strategy';
import { ToastNotifier } from '../../../../core/services/toast-notifier';
import { AppState } from '../../../../core/state/app-state';
import { KEYBOARD_OFFSET_THRESHOLD_PX } from '../../constants/room.constants';
import { ActionFeedback, LiveRoomStore } from '../../store/live-room-store';
import { RoomChatStore } from '../../store/room-chat-store';
import { RoomStageStore } from '../../store/room-stage-store';
import {
  DiscussionMessage,
  ProfilePreviewTarget,
  RoomListener,
  RoomSpeaker,
} from '../../models/live-room.model';
import { BackendReaction, UpdateVoiceRoomPayload } from '../../../../shared/models/voice-room.model';
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

interface ProfilePreviewRequest {
  readonly target: ProfilePreviewTarget;
  readonly id: string;
  readonly seq: number;
}

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
  ],
  templateUrl: './room-page.html',
  styleUrl: './room-page.scss',
})
export class RoomPage {
  readonly id = input.required<string>();

  readonly appState = inject(AppState);
  readonly roomStore = inject(LiveRoomStore);
  readonly stageStore = inject(RoomStageStore);
  readonly chatStore = inject(RoomChatStore);
  readonly toast = inject(ToastNotifier);
  private readonly usersApi = inject(UsersApi);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly titleStrategy = inject(AppTitleStrategy);
  private readonly roomStageRef = viewChild<RoomStage>('roomStage');
  private readonly discussion = viewChild(RoomDiscussion);

  private readonly profilePreviewRequest = signal<ProfilePreviewRequest | null>(null);
  private profilePreviewSeq = 0;
  private readonly previewProfileRes = this.usersApi.userResource(
    () => this.profilePreviewRequest()?.id,
  );
  private readonly previewStatsRes = this.usersApi.socialStatsResource(
    () => this.profilePreviewRequest()?.id,
  );

  readonly sendingComment = signal(false);
  readonly keyboardOffset = signal(0);
  private lastFocusTick = this.appState.focusStageTick();
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

    effect(() => {
      const req = this.profilePreviewRequest();
      if (!req) return;
      const profileError = this.previewProfileRes.error();
      const statsError = this.previewStatsRes.error();
      if (profileError || statsError) {
        untracked(() => {
          this.profilePreviewRequest.set(null);
          this.toast.show(
            errorMessage(profileError ?? statsError, 'Could not load this profile.'),
          );
        });
        return;
      }
      if (
        this.previewProfileRes.status() === 'resolved' &&
        this.previewStatsRes.status() === 'resolved' &&
        this.previewProfileRes.hasValue() &&
        this.previewStatsRes.hasValue()
      ) {
        const profile = this.previewProfileRes.value();
        const stats = this.previewStatsRes.value();
        untracked(() => {
          this.profilePreviewRequest.set(null);
          void this.showProfileDialog(req, profile, stats);
        });
      }
    });

    afterNextRender(() => {
      this.bindVisualViewportKeyboard();
    });

    afterRenderEffect({
      write: () => {
        const tick = this.appState.focusStageTick();
        const stage = this.roomStageRef();
        if (stage && tick > this.lastFocusTick) {
          this.lastFocusTick = tick;
          stage.focusStage();
        }
      },
    });

    // Auto-redirect to rooms list when the room has ended or user was removed
    effect(() => {
      const err = this.roomStore.roomError();
      if (err === 'This room has ended.' || err === 'You were removed from this room.') {
        untracked(() => {
          this.toast.show(err);
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
    const current = this.profilePreviewRequest();
    if (current?.id === id) {
      this.previewProfileRes.reload();
      this.previewStatsRes.reload();
    }
    this.profilePreviewRequest.set({ target, id, seq: ++this.profilePreviewSeq });
  }

  async onSpeakerAction(event: { action: SpeakerMenuAction; speaker: RoomSpeaker }): Promise<void> {
    const { action, speaker } = event;
    if (action === 'profile') {
      this.openProfilePreview({ kind: speaker.role, muted: speaker.muted }, speaker.id);
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
            await this.stageStore.remoteMuteSpeaker(speaker.id),
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
          await this.stageStore.demoteToAudience(speaker.id),
          `${speaker.name} moved to audience.`,
        );
        return;
      case 'remove':
        this.handleFeedback(
          roomId,
          await this.stageStore.removeParticipant(speaker.id),
          `${speaker.name} removed from the room.`,
        );
        return;
      case 'transfer-host':
        this.handleFeedback(
          roomId,
          await this.stageStore.transferHost(speaker.id),
          `Host role transferred to ${speaker.name}.`,
        );
        return;
      default:
        return;
    }
  }

  async onToggleMute(): Promise<void> {
    const roomId = this.id();
    this.handleFeedback(
      roomId,
      await this.roomStore.toggleSelfMic(),
    );
  }

  async onToggleHand(): Promise<void> {
    const roomId = this.id();
    const wasRaised = this.stageStore.handRaised();
    this.handleFeedback(
      roomId,
      await this.stageStore.toggleHandRaised(),
      wasRaised ? 'Hand lowered.' : 'Hand raised.',
    );
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
    this.handleFeedback(roomId, await this.stageStore.promoteToStage(targetId), 'Promoted to stage.');
  }

  async onStageReaction(reaction: BackendReaction): Promise<void> {
    const roomId = this.id();
    this.handleFeedback(roomId, await this.stageStore.triggerStageReaction(reaction));
  }

  async onListenerAction(event: {
    action: ListenerMenuAction;
    listener: RoomListener;
  }): Promise<void> {
    const { action, listener } = event;
    if (action === 'profile') {
      this.openProfilePreview({ kind: 'listener' }, listener.id);
      return;
    }

    const roomId = this.id();
    switch (action) {
      case 'stage':
      case 'approve':
        this.handleFeedback(
          roomId,
          await this.stageStore.promoteToStage(listener.id),
          `${listener.name} moved to stage.`,
        );
        return;
      case 'remove':
        this.handleFeedback(
          roomId,
          await this.stageStore.removeParticipant(listener.id),
          `${listener.name} removed from room.`,
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

  async onChatTopic(text: string): Promise<void> {
    const roomId = this.id();
    this.handleFeedback(roomId, await this.chatStore.setChatTopic(text), 'Chat topic updated.');
  }

  onRetryChat(): void {
    this.chatStore.reloadMessages((ok) => {
      if (ok && !this.destroyRef.destroyed) this.toast.show('Chat loaded.');
    });
  }

  onRefreshChat(): void {
    this.chatStore.reloadMessages((ok) => {
      if (ok && !this.destroyRef.destroyed) this.toast.show('Chat updated.');
    });
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

  private async showProfileDialog(
    req: ProfilePreviewRequest,
    profile: HostProfileDialogData['profile'],
    stats: HostProfileDialogData['stats'],
  ): Promise<void> {
    const isYou = req.id === this.stageStore.currentUserId();
    const ref = this.dialog.open<HostProfileDialog, HostProfileDialogData, string>(
      HostProfileDialog,
      {
        width: '560px',
        maxWidth: 'calc(100vw - 24px)',
        data: { profile, stats, target: req.target, isYou },
      },
    );
    const action = await lastValueFrom(ref.afterClosed());
    if (!this.destroyRef.destroyed && isYou && action === 'view-profile') {
      void this.router.navigate(['/profile']);
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
