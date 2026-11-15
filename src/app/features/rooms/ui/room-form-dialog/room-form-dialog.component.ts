import { Component, input, model, output } from '@angular/core';
import { Dialog } from '@openng/optimus-ui/dialog';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import type { Room, RoomDraft, RoomEdit } from '../../models/room.model';
import { RoomFormComponent } from '../room-form/room-form.component';

@Component({
  selector: 'app-room-form-dialog',
  imports: [Dialog, RoomFormComponent, TranslatePipe],
  template: `
    <p-dialog
      [modal]="true"
      [dismissableMask]="true"
      [style]="{ width: '32rem', maxWidth: '95vw' }"
      [header]="room() ? ('Edit the room' | t) : ('Start a room' | t)"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
    >
      @if (visible()) {
        <app-room-form
          [room]="room()"
          [defaults]="defaults()"
          [submitting]="submitting()"
          [error]="error()"
          (saved)="saved.emit($event)"
          (edited)="edited.emit($event)"
          (cancelled)="visible.set(false)"
        />
      }
    </p-dialog>
  `,
})
export class RoomFormDialogComponent {
  readonly visible = model(false);
  readonly room = input<Room>();
  readonly defaults = input<RoomDraft>();
  readonly submitting = input(false);
  readonly error = input<string | null>(null);

  readonly saved = output<RoomDraft>();
  readonly edited = output<RoomEdit>();
}
