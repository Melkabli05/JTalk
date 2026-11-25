import { Component, inject, signal } from '@angular/core';
import { form, FormField, FormRoot, maxLength } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CreateVoiceRoomPayload } from '../../../shared/models/voice-room.model';
import { LANGUAGE_CATALOG } from '../../../core/utils/language-codes';
import { trimmedRequired } from '../../../shared/utils/form-validators';

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

  readonly languages = LANGUAGE_CATALOG.filter(language => ['en', 'es', 'fr', 'ar', 'ja', 'de'].includes(language.code));
  readonly seatOptions = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  private readonly model = signal({
    title: 'Practice room',
    topic: 'Just chatting',
    targetLanguage: 'es',
    nativeLanguage: 'en',
    maxStageSeats: 6,
  });

  readonly roomForm = form(this.model, (schemaPath) => {
    trimmedRequired(schemaPath.title, 'Room title is required.');
    maxLength(schemaPath.title, 80, { message: 'Use 80 characters or fewer.' });
    maxLength(schemaPath.topic, 255, { message: 'Use 255 characters or fewer.' });
  }, {
    submission: {
      action: async (field) => {
        const config = field().value();
        this.dialogRef.close({
          ...config,
          title: config.title.trim(),
          topic: config.topic.trim() || 'Just chatting',
        });
      },
    },
  });
}
