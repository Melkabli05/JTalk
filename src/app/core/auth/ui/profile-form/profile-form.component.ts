import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { FormField, FormRoot, form, maxLength, required } from '@angular/forms/signals';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { AvatarPickerComponent } from '@shared/ui/avatar-picker/avatar-picker.component';
import {
  SelectFieldComponent,
  type SelectOption,
} from '@shared/ui/select-field/select-field.component';
import { TextFieldComponent } from '@shared/ui/text-field/text-field.component';
import { TextareaFieldComponent } from '@shared/ui/textarea-field/textarea-field.component';
import { avatarOrDefault } from '@shared/utils/avatars';
import { formSubmission } from '@shared/utils/form-submission';
import { COUNTRY_CODES } from '@shared/utils/countries';
import { LANGUAGES } from '@shared/utils/languages';
import { countryNameOf, flagOf } from '@shared/utils/people';
import type { Person, ProfileDraft } from '../../identity.models';

interface ProfileFormModel {
  name: string;
  avatar: string;
  nativeLanguage: string;
  learning: string;
  bio: string;
  countryCode: string;
}

@Component({
  selector: 'app-profile-form',
  imports: [
    AvatarPickerComponent,
    ButtonDirective,
    FormField,
    FormRoot,
    SelectFieldComponent,
    TextFieldComponent,
    TextareaFieldComponent,
  ],
  templateUrl: './profile-form.component.html',
  styleUrl: './profile-form.component.scss',
})
export class ProfileFormComponent {
  readonly profile = input<Person>();
  /** A save is in flight: a second submit is ignored and the button waits. */
  readonly busy = input(false);

  readonly saved = output<ProfileDraft>();

  protected readonly languages: readonly SelectOption<string>[] = LANGUAGES.map((language) => ({
    value: language.code,
    label: language.name,
    prefix: language.flag,
  }));

  protected readonly countries = computed<readonly SelectOption<string>[]>(() => [
    { value: '', label: 'Not set' },
    ...COUNTRY_CODES.map((code) => ({
      value: code,
      label: countryNameOf(code),
      prefix: flagOf(code),
    })).sort((a, b) => a.label.localeCompare(b.label, 'en')),
  ]);

  private readonly model = linkedSignal<ProfileFormModel>(() => ({
    name: this.profile()?.name ?? '',
    avatar: avatarOrDefault(this.profile()?.avatar),
    nativeLanguage: this.profile()?.nativeLanguage ?? 'ar',
    learning: this.profile()?.learning ?? 'en',
    bio: this.profile()?.bio ?? '',
    countryCode: this.profile()?.countryCode ?? '',
  }));

  protected readonly profileForm = form(
    this.model,
    (path) => {
      required(path.name, { message: 'Enter your name.' });
      maxLength(path.name, 40, { message: 'Use at most 40 characters.' });
      required(path.nativeLanguage, { message: 'Choose a language.' });
      required(path.learning, { message: 'Choose a language.' });
      maxLength(path.bio, 300, { message: 'Use at most 300 characters.' });
    },
    {
      submission: formSubmission<ProfileFormModel>({
        busy: () => this.busy(),
        submit: (value) =>
          this.saved.emit({
            name: value.name.trim(),
            avatar: value.avatar,
            nativeLanguage: value.nativeLanguage,
            learning: value.learning,
            bio: value.bio.trim(),
            countryCode: value.countryCode,
          }),
      }),
    },
  );
}
