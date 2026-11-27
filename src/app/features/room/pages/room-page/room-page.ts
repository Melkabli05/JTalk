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
  ProfilePreviewTarget,
  RoomListener,
  RoomSpeaker,
} from '../../models/live-room.model';
import { RoomFacade } from '../../store/room.facade';
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
    const ref = this.dialog.open<
      EditRoomDialog,
      Required<UpdateVoiceRoomPayload>,
      UpdateVoiceRoomPayload
    >(EditRoomDialog, {
      width: '440px',
      maxWidth: 'calc(100vw - 24px)',
      data: this.facade.editRoomData(),
    });

    ref.afterClosed().subscribe((result) => {
      if (!result || this.destroyRef.destroyed || this.id() !== roomId || !this.isCurrentRoom()) {
        return;
      }
      this.facade.updateRoom(roomId, result);
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

  onSendMessage(text: string): void {
    const discussion = this.discussion();
    this.facade.sendMessage(this.id(), text, () => discussion?.clearSentDraft(text));
  }

  onStageReaction(reaction: BackendReaction): void {
    this.facade.sendStageReaction(this.id(), reaction);
  }

  onListenerAction(event: { action: ListenerMenuAction; listener: RoomListener }): void {
    this.facade.listenerAction(this.id(), event, (id, target) => this.openProfilePreview(id, target));
  }

  onSpeakerAction(event: { action: SpeakerMenuAction; speaker: RoomSpeaker }): void {
    this.facade.speakerAction(this.id(), event, (id, target) => this.openProfilePreview(id, target));
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
