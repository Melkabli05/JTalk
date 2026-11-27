import { Component, inject, signal } from '@angular/core';
import { form, FormField, FormRoot, maxLength } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CreateVoiceRoomPayload } from '../../../shared/models/voice-room.model';
import { LANGUAGE_CATALOG } from '../../../core/utils/language-codes';
import { trimmedRequired } from '../../../shared/utils/form-validators';

export interface StartRoomDialogData {
  readonly defaults?: Partial<
    Pick<CreateVoiceRoomPayload, 'targetLanguage' | 'nativeLanguage' | 'maxStageSeats'>
  >;
  readonly submit?: (payload: CreateVoiceRoomPayload) => Promise<string | null>;
}

const DEFAULT_MAX_STAGE_SEATS = 8;

@Component({
  selector: 'app-start-room-dialog',
  imports: [
    FormField,
    FormRoot,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './start-room-dialog.html',
  styleUrl: './start-room-dialog.scss',
})
export class StartRoomDialog {
  private readonly dialogRef = inject(MatDialogRef<StartRoomDialog, CreateVoiceRoomPayload>);
  private readonly data = inject<StartRoomDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  readonly languages = LANGUAGE_CATALOG;
  readonly seatOptions = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  readonly submitError = signal<string | null>(null);

  private readonly model = signal({
    title: 'Practice room',
    topic: 'Just chatting',
    targetLanguage: this.data?.defaults?.targetLanguage ?? 'es',
    nativeLanguage: this.data?.defaults?.nativeLanguage ?? 'en',
    maxStageSeats: this.data?.defaults?.maxStageSeats ?? DEFAULT_MAX_STAGE_SEATS,
  });

  readonly roomForm = form(
    this.model,
    (schemaPath) => {
      trimmedRequired(schemaPath.title, 'Room title is required.');
      maxLength(schemaPath.title, 80, { message: 'Use 80 characters or fewer.' });
      maxLength(schemaPath.topic, 255, { message: 'Use 255 characters or fewer.' });
    },
    {
      submission: {
        action: async (field) => {
          this.submitError.set(null);
          const config = field().value();
          const payload: CreateVoiceRoomPayload = {
            ...config,
            title: config.title.trim(),
            topic: config.topic.trim() || 'Just chatting',
          };
          if (this.data?.submit) {
            const err = await this.data.submit(payload);
            if (err) {
              this.submitError.set(err);
              return;
            }
            this.dialogRef.close();
            return;
          }
          this.dialogRef.close(payload);
        },
      },
    },
  );
}
