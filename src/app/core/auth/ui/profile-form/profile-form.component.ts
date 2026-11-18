import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { FormField, FormRoot, form, maxLength, required } from '@angular/forms/signals';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { AvatarPickerComponent } from '@shared/ui/avatar-picker/avatar-picker.component';
import {
  SelectFieldComponent,
  type SelectOption,
} from '@shared/ui/select-field/select-field.component';
import { TextFieldComponent } from '@shared/ui/text-field/text-field.component';
import { TextareaFieldComponent } from '@shared/ui/textarea-field/textarea-field.component';
import { avatarOrDefault } from '@shared/utils/avatars';
import { formSubmission } from '@shared/utils/form-submission';
import { msg } from '@shared/utils/i18n/msg';
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
    TranslatePipe,
  ],
  templateUrl: './profile-form.component.html',
  styleUrl: './profile-form.component.scss',
})
export class ProfileFormComponent {
  readonly profile = input<Person>();
  readonly locale = input('en');

  readonly saved = output<ProfileDraft>();

  protected readonly languages: readonly SelectOption<string>[] = LANGUAGES.map((language) => ({
    value: language.code,
    label: language.name,
    prefix: language.flag,
  }));

  protected readonly countries = computed<readonly SelectOption<string>[]>(() => [
    { value: '', label: msg('Not set') },
    ...COUNTRY_CODES.map((code) => ({
      value: code,
      label: countryNameOf(code, this.locale()),
      prefix: flagOf(code),
    })).sort((a, b) => a.label.localeCompare(b.label, this.locale())),
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
      required(path.name, { message: msg('Enter your name.') });
      maxLength(path.name, 40, { message: msg('Use at most 40 characters.') });
      required(path.nativeLanguage, { message: msg('Choose a language.') });
      required(path.learning, { message: msg('Choose a language.') });
      maxLength(path.bio, 300, { message: msg('Use at most 300 characters.') });
    },
    {
      submission: formSubmission<ProfileFormModel>({
        busy: () => false,
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
