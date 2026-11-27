import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  max,
  maxLength,
  min,
  required,
  validate,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { UpdateVoiceRoomPayload } from '../../../../shared/models/voice-room.model';
import {
  noBlankOnlyText,
  sanitizeUserText,
  trimmedRequired,
} from '../../../../shared/utils/form-validators';

export interface EditRoomDialogData extends Required<UpdateVoiceRoomPayload> {
  readonly submit?: (patch: UpdateVoiceRoomPayload) => Promise<string | null>;
}

interface EditRoomFormModel {
  title: string;
  topic: string;
  maxStageSeats: number | null;
}

@Component({
  selector: 'app-edit-room-dialog',
  imports: [
    FormField,
    FormRoot,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './edit-room-dialog.html',
  styleUrl: './edit-room-dialog.scss',
})
export class EditRoomDialog {
  private readonly dialogRef = inject(MatDialogRef<EditRoomDialog, UpdateVoiceRoomPayload>);
  private readonly data = inject<EditRoomDialogData>(MAT_DIALOG_DATA);

  readonly submitError = signal<string | null>(null);

  private readonly model = signal<EditRoomFormModel>({
    title: this.data.title,
    topic: this.data.topic,
    maxStageSeats: this.data.maxStageSeats,
  });

  readonly roomForm = form(
    this.model,
    (path) => {
      trimmedRequired(path.title, 'Room title is required.');
      maxLength(path.title, 80, { message: 'Use 80 characters or fewer.' });
      noBlankOnlyText(path.topic, 'Enter valid text or leave the topic blank.');
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
    },
    {
      submission: {
        action: async (field) => {
          this.submitError.set(null);
          const values = field().value();
          const title = sanitizeUserText(values.title);
          const topic = sanitizeUserText(values.topic);
          const seats = values.maxStageSeats;
          const patch: UpdateVoiceRoomPayload = {
            ...(title !== this.data.title && { title }),
            ...(topic !== this.data.topic && { topic }),
            ...(seats !== null && seats !== this.data.maxStageSeats && { maxStageSeats: seats }),
          };
          if (Object.keys(patch).length === 0) {
            this.dialogRef.close(undefined);
            return;
          }
          if (this.data.submit) {
            const err = await this.data.submit(patch);
            if (err) {
              this.submitError.set(err);
              return;
            }
            this.dialogRef.close(undefined);
            return;
          }
          this.dialogRef.close(patch);
        },
      },
    },
  );
}
