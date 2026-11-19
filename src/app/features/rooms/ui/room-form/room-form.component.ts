import { Component, input, linkedSignal, output } from '@angular/core';
import { FormField, FormRoot, form, maxLength, max, min, required } from '@angular/forms/signals';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Message } from '@openng/optimus-ui/message';
import {
  SelectFieldComponent,
  type SelectOption,
} from '@shared/ui/select-field/select-field.component';
import { TextFieldComponent } from '@shared/ui/text-field/text-field.component';
import { formSubmission } from '@shared/utils/form-submission';
import type { Room, RoomDraft, RoomEdit } from '../../models/room.model';
import { LANGUAGES } from '@shared/utils/languages';

interface RoomFormModel {
  title: string;
  topic: string;
  targetLanguage: string;
  nativeLanguage: string;
  maxStageSeats: number | null;
}

const MIN_SEATS = 2;
const MAX_SEATS = 12;
const DEFAULT_SEATS = 6;

@Component({
  selector: 'app-room-form',
  imports: [
    FormField,
    FormRoot,
    ButtonDirective,
    Message,
    SelectFieldComponent,
    TextFieldComponent,
  ],
  templateUrl: './room-form.component.html',
  styleUrl: './room-form.component.scss',
})
export class RoomFormComponent {
  readonly room = input<Room>();
  readonly defaults = input<RoomDraft>();
  readonly submitting = input(false);
  readonly error = input<string | null>(null);

  readonly saved = output<RoomDraft>();
  readonly edited = output<RoomEdit>();
  readonly cancelled = output<void>();

  protected readonly languages: readonly SelectOption<string>[] = LANGUAGES.map((language) => ({
    value: language.code,
    label: language.name,
    prefix: language.flag,
  }));
  protected readonly seats: readonly SelectOption<number>[] = Array.from(
    { length: MAX_SEATS - MIN_SEATS + 1 },
    (_, index) => ({ value: MIN_SEATS + index, label: String(MIN_SEATS + index) }),
  );

  private readonly model = linkedSignal<RoomFormModel>(() => {
    const start = this.room() ?? this.defaults();
    return {
      title: start?.title ?? '',
      topic: start?.topic ?? '',
      targetLanguage: start?.targetLanguage ?? 'es',
      nativeLanguage: start?.nativeLanguage ?? 'en',
      maxStageSeats: start?.maxStageSeats ?? DEFAULT_SEATS,
    };
  });

  protected readonly roomForm = form(
    this.model,
    (path) => {
      required(path.title, { message: 'Give the room a title.' });
      maxLength(path.title, 80, { message: 'Use at most 80 characters.' });
      maxLength(path.topic, 255, { message: 'Use at most 255 characters.' });
      required(path.targetLanguage, { message: 'Choose a language.' });
      required(path.nativeLanguage, { message: 'Choose a language.' });
      required(path.maxStageSeats, { message: 'Choose the number of seats.' });
      min(path.maxStageSeats, MIN_SEATS, { message: 'A room needs at least 2 seats.' });
      max(path.maxStageSeats, MAX_SEATS, { message: 'A room has at most 12 seats.' });
    },
    {
      submission: formSubmission<RoomFormModel>({
        busy: () => this.submitting(),
        submit: (value) => {
          const title = value.title.trim();
          const topic = value.topic.trim();
          const maxStageSeats = value.maxStageSeats ?? DEFAULT_SEATS;
          if (this.room()) {
            this.edited.emit({ title, topic, maxStageSeats });
          } else {
            this.saved.emit({
              title,
              topic,
              maxStageSeats,
              targetLanguage: value.targetLanguage,
              nativeLanguage: value.nativeLanguage,
            });
          }
        },
      }),
    },
  );
}
