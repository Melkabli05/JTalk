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
import {
  BackendReaction,
  UpdateVoiceRoomPayload,
} from '../../../../shared/models/voice-room.model';
import { SkeletonLoader } from '../../../../shared/ui/skeleton-loader/skeleton-loader';
import { KEYBOARD_OFFSET_THRESHOLD_PX } from '../../constants/room.constants';
import {
  ConfirmActionDialogData,
  DiscussionMessage,
  HostProfileDialogData,
  ListenerMenuAction,
  ProfilePreviewTarget,
  RoomListener,
  RoomSpeaker,
  SpeakerMenuAction,
} from '../../models/live-room.model';
import { RoomFacade } from '../../store/room.facade';
import { ConfirmActionDialog } from '../../ui/confirm-action-dialog/confirm-action-dialog';
import { EditRoomDialog, type EditRoomDialogData } from '../../ui/edit-room-dialog/edit-room-dialog';
import { EndRoomDialog, type EndRoomDialogData } from '../../ui/end-room-dialog/end-room-dialog';
import { HostProfileDialog } from '../../ui/host-profile-dialog/host-profile-dialog';
import { RoomAudience } from '../../ui/room-audience/room-audience';
import { RoomControls } from '../../ui/room-controls/room-controls';
import { RoomDiscussion } from '../../ui/room-discussion/room-discussion';
import { RoomStage } from '../../ui/room-stage/room-stage';
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
  readonly facade = inject(RoomFacade);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  private readonly roomStageRef = viewChild<RoomStage>('roomStage');
  private readonly discussion = viewChild(RoomDiscussion);

  readonly keyboardOffset = signal(0);
  private lastFocusTick = this.facade.focusStageTick();
  readonly isCurrentRoom = computed(() => this.facade.roomId() === this.id());

  constructor() {
    effect(() => {
      const roomId = this.id();
      untracked(() => this.facade.enterRoom(roomId));
    });

    effect(() => {
      const activeId = this.id();
      this.facade.syncPageTitle(activeId);
    });

    afterNextRender(() => {
      this.bindVisualViewportKeyboard();
    });

    afterRenderEffect({
      write: () => {
        const tick = this.facade.focusStageTick();
        const stage = this.roomStageRef();
        if (stage && tick > this.lastFocusTick) {
          this.lastFocusTick = tick;
          stage.focusStage();
        }
      },
    });
  }

  openEditRoomDialog(): void {
    const roomId = this.id();
    const ref = this.dialog.open<EditRoomDialog, EditRoomDialogData, UpdateVoiceRoomPayload>(
      EditRoomDialog,
      {
        width: '440px',
        maxWidth: 'calc(100vw - 24px)',
        data: {
          ...this.facade.editRoomData(),
          submit: (patch) => {
            if (this.destroyRef.destroyed || this.id() !== roomId || !this.isCurrentRoom()) {
              return Promise.resolve('You are no longer in this room.');
            }
            return this.facade.saveRoomSettings(roomId, patch);
          },
        },
      },
    );

    ref.afterClosed().subscribe((result) => {
      if (!result || this.destroyRef.destroyed || this.id() !== roomId || !this.isCurrentRoom()) {
        return;
      }
      this.facade.updateRoom(roomId, result);
    });
  }

  openEndRoomDialog(): void {
    const roomId = this.id();
    const ref = this.dialog.open<EndRoomDialog, EndRoomDialogData, boolean>(EndRoomDialog, {
      width: '440px',
      maxWidth: 'calc(100vw - 24px)',
      data: { roomTitle: this.facade.effectiveRoomTitle() },
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (
        !confirmed ||
        this.destroyRef.destroyed ||
        this.id() !== roomId ||
        !this.isCurrentRoom()
      ) {
        return;
      }
      this.facade.endRoom(roomId);
    });
  }

  openProfilePreview(id: string, target: ProfilePreviewTarget): void {
    this.facade.loadProfilePreview(id, target, (data) => {
      if (this.destroyRef.destroyed) return;
      const ref = this.dialog.open<HostProfileDialog, HostProfileDialogData, string>(
        HostProfileDialog,
        {
          width: '560px',
          maxWidth: 'calc(100vw - 24px)',
          data,
        },
      );
      ref.afterClosed().subscribe((action) => {
        if (!this.destroyRef.destroyed && data.isYou && action === 'view-profile') {
          this.facade.navigateTo('/profile');
        }
      });
    });
  }

  onOpenCommentProfile(msg: DiscussionMessage): void {
    if (!msg.authorId) return;
    const speaker = this.facade.speakers().find((s) => s.id === msg.authorId);
    const target: ProfilePreviewTarget = speaker
      ? { kind: speaker.role, muted: speaker.muted }
      : { kind: 'listener' };
    this.openProfilePreview(msg.authorId, target);
  }

  onSendMessage(text: string): void {
    const discussion = this.discussion();
    this.facade.sendMessage(this.id(), text, () => discussion?.clearSentDraft(text));
  }

  onStageReaction(reaction: BackendReaction): void {
    this.facade.sendStageReaction(this.id(), reaction);
  }

  onListenerAction(event: { action: ListenerMenuAction; listener: RoomListener }): void {
    if (event.action === 'remove') {
      this.confirmHostAction(
        {
          title: `Remove ${event.listener.name} from the room?`,
          message:
            'They will be disconnected immediately and cannot rejoin this room.',
          confirmLabel: 'Remove',
          danger: true,
        },
        () =>
          this.facade.listenerAction(this.id(), event, (id, target) =>
            this.openProfilePreview(id, target),
          ),
      );
      return;
    }
    if (event.action === 'transfer-host') {
      this.confirmHostAction(
        {
          title: `Make ${event.listener.name} the host?`,
          message: `You will no longer control this room, and ${event.listener.name} will become the host.`,
          confirmLabel: 'Transfer host',
        },
        () =>
          this.facade.listenerAction(this.id(), event, (id, target) =>
            this.openProfilePreview(id, target),
          ),
      );
      return;
    }
    this.facade.listenerAction(this.id(), event, (id, target) =>
      this.openProfilePreview(id, target),
    );
  }

  onSpeakerAction(event: { action: SpeakerMenuAction; speaker: RoomSpeaker }): void {
    if (event.action === 'remove') {
      this.confirmHostAction(
        {
          title: `Remove ${event.speaker.name} from the room?`,
          message:
            'They will be disconnected immediately and cannot rejoin this room.',
          confirmLabel: 'Remove',
          danger: true,
        },
        () =>
          this.facade.speakerAction(this.id(), event, (id, target) =>
            this.openProfilePreview(id, target),
          ),
      );
      return;
    }
    if (event.action === 'transfer-host') {
      this.confirmHostAction(
        {
          title: `Make ${event.speaker.name} the host?`,
          message: `You will remain on stage as a speaker, and ${event.speaker.name} will control this room.`,
          confirmLabel: 'Transfer host',
        },
        () =>
          this.facade.speakerAction(this.id(), event, (id, target) =>
            this.openProfilePreview(id, target),
          ),
      );
      return;
    }
    this.facade.speakerAction(this.id(), event, (id, target) =>
      this.openProfilePreview(id, target),
    );
  }

  private confirmHostAction(data: ConfirmActionDialogData, onConfirmed: () => void): void {
    const roomId = this.id();
    const ref = this.dialog.open<ConfirmActionDialog, ConfirmActionDialogData, boolean>(
      ConfirmActionDialog,
      {
        width: '440px',
        maxWidth: 'calc(100vw - 24px)',
        data,
      },
    );
    ref.afterClosed().subscribe((confirmed) => {
      if (
        !confirmed ||
        this.destroyRef.destroyed ||
        this.id() !== roomId ||
        !this.isCurrentRoom()
      ) {
        return;
      }
      onConfirmed();
    });
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
