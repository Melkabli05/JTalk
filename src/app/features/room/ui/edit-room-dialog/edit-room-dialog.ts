import { Component, inject, signal } from '@angular/core';
import { form, FormField, FormRoot, max, maxLength, min, required, validate } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { UpdateVoiceRoomPayload } from '../../../../shared/models/voice-room.model';
import { trimmedRequired } from '../../../../shared/utils/form-validators';

interface EditRoomFormModel {
  title: string;
  topic: string;
  maxStageSeats: number | null;
}

@Component({
  selector: 'app-edit-room-dialog',
  imports: [FormField, FormRoot, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './edit-room-dialog.html',
  styleUrl: './edit-room-dialog.scss',
})
export class EditRoomDialog {
  private readonly dialogRef = inject(MatDialogRef<EditRoomDialog, UpdateVoiceRoomPayload>);
  private readonly data = inject<Required<UpdateVoiceRoomPayload>>(MAT_DIALOG_DATA);

  private readonly model = signal<EditRoomFormModel>({
    title: this.data.title,
    topic: this.data.topic,
    maxStageSeats: this.data.maxStageSeats,
  });

  readonly roomForm = form(this.model, (path) => {
    trimmedRequired(path.title, 'Room title is required.');
    maxLength(path.title, 80, { message: 'Use 80 characters or fewer.' });
    maxLength(path.topic, 255, { message: 'Use 255 characters or fewer.' });
    required(path.maxStageSeats, { message: 'Enter the number of stage seats.' });
    min(path.maxStageSeats, 2, { message: 'Use at least 2 seats.' });
    max(path.maxStageSeats, 12, { message: 'Use at most 12 seats.' });
    validate(path.maxStageSeats, ({ value }) => {
      const seats = value();
      if (seats !== null && !Number.isInteger(seats)) {
        return { kind: 'integer', message: 'Enter a whole number of seats.' };
      }
      return undefined;
    });
  }, {
    submission: {
      action: async (field) => {
        const values = field().value();
        const title = values.title.trim();
        const topic = values.topic.trim();
        const seats = values.maxStageSeats;
        const patch: UpdateVoiceRoomPayload = {
          ...(title !== this.data.title && { title }),
          ...(topic !== this.data.topic && { topic }),
          ...(seats !== null && seats !== this.data.maxStageSeats && { maxStageSeats: seats }),
        };
        this.dialogRef.close(Object.keys(patch).length ? patch : undefined);
      },
    },
  });
}
