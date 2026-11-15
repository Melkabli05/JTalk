import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { FormField, FormRoot, form, maxLength, required } from '@angular/forms/signals';
import { Avatar } from '@openng/optimus-ui/avatar';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { AvatarPickerComponent } from '@shared/ui/avatar-picker/avatar-picker.component';
import {
  SelectFieldComponent,
  type SelectOption,
} from '@shared/ui/select-field/select-field.component';
import { TextFieldComponent } from '@shared/ui/text-field/text-field.component';
import { avatarOrDefault, avatarUrl } from '@shared/utils/avatars';
import { formSubmission } from '@shared/utils/form-submission';
import { msg } from '@shared/utils/i18n/msg';
import { LANGUAGES, languageOf } from '@shared/utils/languages';
import type { Person, ProfileDraft } from '../../identity.models';

interface ProfileFormModel {
  name: string;
  avatar: string;
  nativeLanguage: string;
  learning: string;
}

/**
 * Presentational profile form: a name, a picture, what you speak and what you are learning, with a preview of how others
 * will see you. It emits a valid draft and never saves it.
 */
@Component({
  selector: 'app-profile-form',
  imports: [
    Avatar,
    AvatarPickerComponent,
    ButtonDirective,
    FormField,
    FormRoot,
    SelectFieldComponent,
    TextFieldComponent,
    TranslatePipe,
  ],
  templateUrl: './profile-form.component.html',
  styleUrl: './profile-form.component.scss',
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
    avatar: avatarOrDefault(this.profile()?.avatar),
    nativeLanguage: this.profile()?.nativeLanguage ?? 'ar',
    learning: this.profile()?.learning ?? 'en',
  }));

  protected readonly preview = computed(() => {
    const { name, avatar, nativeLanguage, learning } = this.model();
    return {
      name: name.trim(),
      picture: avatarUrl(avatar),
      native: languageOf(nativeLanguage),
      learning: languageOf(learning),
    };
  });

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
            avatar: value.avatar,
            nativeLanguage: value.nativeLanguage,
            learning: value.learning,
          }),
      }),
    },
  );
}
