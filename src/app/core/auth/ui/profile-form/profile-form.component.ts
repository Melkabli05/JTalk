import { Component, input, linkedSignal, output } from '@angular/core';
import { FormField, FormRoot, form, maxLength, required } from '@angular/forms/signals';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import {
  SelectFieldComponent,
  type SelectOption,
} from '@shared/ui/select-field/select-field.component';
import { TextFieldComponent } from '@shared/ui/text-field/text-field.component';
import { formSubmission } from '@shared/utils/form-submission';
import { msg } from '@shared/utils/i18n/msg';
import { LANGUAGES } from '@shared/utils/languages';
import type { Person, ProfileDraft } from '../../identity.models';

interface ProfileFormModel {
  name: string;
  nativeLanguage: string;
  learning: string;
}

/** Presentational profile form: who you are, what you speak and what you are learning. It emits a valid draft and never saves it. */
@Component({
  selector: 'app-profile-form',
  imports: [
    ButtonDirective,
    FormField,
    FormRoot,
    SelectFieldComponent,
    TextFieldComponent,
    TranslatePipe,
  ],
  template: `
    <form class="form" [formRoot]="profileForm">
      <app-text-field
        [label]="'Your name' | t"
        autocomplete="nickname"
        [formField]="profileForm.name"
      />
      <app-select-field
        [label]="'I speak' | t"
        [options]="languages"
        [formField]="profileForm.nativeLanguage"
      />
      <app-select-field
        [label]="'I am learning' | t"
        [options]="languages"
        [formField]="profileForm.learning"
      />

      <div class="actions">
        @if (cancellable()) {
          <button
            pButton
            type="button"
            severity="secondary"
            [text]="true"
            [label]="'Cancel' | t"
            (click)="cancelled.emit()"
          ></button>
        }
        <button
          pButton
          type="submit"
          [label]="profile() ? ('Save' | t) : ('Continue' | t)"
        ></button>
      </div>
    </form>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `,
})
export class ProfileFormComponent {
  readonly profile = input<Person>();
  readonly cancellable = input(false);

  readonly saved = output<ProfileDraft>();
  readonly cancelled = output<void>();

  protected readonly languages: readonly SelectOption<string>[] = LANGUAGES.map((language) => ({
    value: language.code,
    label: language.name,
    prefix: language.flag,
  }));

  private readonly model = linkedSignal<ProfileFormModel>(() => ({
    name: this.profile()?.name ?? '',
    nativeLanguage: this.profile()?.nativeLanguage ?? 'ar',
    learning: this.profile()?.learning ?? 'en',
  }));

  protected readonly profileForm = form(
    this.model,
    (path) => {
      required(path.name, { message: msg('Enter your name.') });
      maxLength(path.name, 40, { message: msg('Use at most 40 characters.') });
      required(path.nativeLanguage, { message: msg('Choose a language.') });
      required(path.learning, { message: msg('Choose a language.') });
    },
    {
      submission: formSubmission<ProfileFormModel>({
        busy: () => false,
        submit: (value) =>
          this.saved.emit({
            name: value.name.trim(),
            nativeLanguage: value.nativeLanguage,
            learning: value.learning,
          }),
      }),
    },
  );
}
