import { DestroyRef, inject, Service } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { IdentityStore } from '../auth/identity';
import { errorMessage } from '../http/http-error.interceptor';
import { CreateVoiceRoomPayload } from '../../shared/models/voice-room.model';
import { ToastNotifier } from './toast-notifier';
import { RoomsApi } from '../../features/rooms/data-access/rooms-api';

@Service()
export class RoomLauncher {
  private readonly dialog = inject(MatDialog);
  private readonly identity = inject(IdentityStore);
  private readonly roomsApi = inject(RoomsApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastNotifier);
  private creatingRoom = false;

  async openStartRoom(destroyRef?: DestroyRef): Promise<void> {
    if (this.creatingRoom) return;

    if (!this.identity.isAuthenticated()) {
      this.identity.signIn('login', '/rooms');
      return;
    }

    if (this.identity.needsOnboarding()) {
      this.toast.show('Create your profile first to start a room.');
      void this.router.navigate(['/profile']);
      return;
    }

    const dialogId = 'start-room';
    let dialogModule: typeof import('../../layout/ui/start-room-dialog/start-room-dialog');
    try {
      dialogModule = await import('../../layout/ui/start-room-dialog/start-room-dialog');
    } catch {
      if (!destroyRef?.destroyed) {
        this.toast.show('Could not load the room form. Please try again.');
      }
      return;
    }

    if (destroyRef?.destroyed || this.creatingRoom || this.dialog.getDialogById(dialogId)) return;

    const ref = this.dialog.open<
      InstanceType<typeof dialogModule.StartRoomDialog>,
      void,
      CreateVoiceRoomPayload
    >(dialogModule.StartRoomDialog, {
      id: dialogId,
      width: '560px',
      maxWidth: 'calc(100vw - 24px)',
      autoFocus: 'first-tabbable',
    });

    const config = await lastValueFrom(ref.afterClosed());
    if (!config || destroyRef?.destroyed || this.creatingRoom) return;

    this.creatingRoom = true;
    this.roomsApi.createRoom(config).subscribe({
      next: (session) => {
        this.creatingRoom = false;
        void this.router.navigate(['/room', session.room.id]).then((navigated) => {
          if (navigated) {
            this.toast.show('Room open.');
          }
        });
      },
      error: (err: unknown) => {
        this.creatingRoom = false;
        this.toast.show(errorMessage(err, 'Could not start the room.'));
      },
    });
  }
}
