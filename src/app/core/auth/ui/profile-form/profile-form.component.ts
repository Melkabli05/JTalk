import {
  Component,
  computed,
  effect,
  input,
  linkedSignal,
  type OnDestroy,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  FormField,
  FormRoot,
  form,
  hidden,
  maxLength,
  pattern,
  required,
} from '@angular/forms/signals';
import { ButtonDirective } from '@openng/optimus-ui/button';
import {
  AvatarPickerComponent,
  CUSTOM_AVATAR,
} from '@shared/ui/avatar-picker/avatar-picker.component';
import {
  SelectFieldComponent,
  type SelectOption,
} from '@shared/ui/select-field/select-field.component';
import { TextFieldComponent } from '@shared/ui/text-field/text-field.component';
import { TextareaFieldComponent } from '@shared/ui/textarea-field/textarea-field.component';
import { avatarOrDefault, avatarUrl, isUploadedAvatar } from '@shared/utils/avatars';
import { formSubmission } from '@shared/utils/form-submission';
import { COUNTRY_CODES } from '@shared/utils/countries';
import { LANGUAGES } from '@shared/utils/languages';
import { countryNameOf, flagOf } from '@shared/utils/people';
import type { Person, ProfileDraft } from '../../identity.models';

/** What a username may be: what the user service accepts, once it is in lowercase (which the form does when it sends it). */
const USERNAME = /^[a-z0-9_.]{3,30}$/i;

interface ProfileFormModel {
  name: string;
  username: string;
  /** The id of one of our pictures, or {@link CUSTOM_AVATAR} for the one they uploaded (the one they have, or the one just chosen). */
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
export class ProfileFormComponent implements OnDestroy {
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

  /** The picture they just chose, small and square, waiting for the save that sends it. */
  private readonly pending = signal<{ readonly blob: Blob; readonly preview: string } | null>(null);

  /** Where to show their own picture from: the one just chosen, or else the one they uploaded before. */
  protected readonly custom = computed(
    () =>
      this.pending()?.preview ??
      (isUploadedAvatar(this.profile()?.avatar) ? avatarUrl(this.profile()?.avatar) : null),
  );

  private readonly model = linkedSignal<ProfileFormModel>(() => ({
    name: this.profile()?.name ?? '',
    username: this.profile()?.username ?? '',
    avatar: isUploadedAvatar(this.profile()?.avatar)
      ? CUSTOM_AVATAR
      : avatarOrDefault(this.profile()?.avatar),
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
      // A username is only edited, never asked for, when the profile is made.
      hidden(path.username, { when: () => !this.profile() });
      required(path.username, { message: 'Enter a username.' });
      pattern(path.username, USERNAME, {
        message: 'Use 3 to 30 letters, numbers, _ or .',
      });
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
            ...(this.profile() ? { username: value.username.trim().toLowerCase() } : {}),
            ...this.pictureOf(value.avatar),
            nativeLanguage: value.nativeLanguage,
            learning: value.learning,
            bio: value.bio.trim(),
            countryCode: value.countryCode,
          }),
      }),
    },
  );

  constructor() {
    // Once their picture is saved it is the profile's, not a waiting one: a later save must not send it again.
    effect(() => {
      void this.profile()?.avatar;
      untracked(() => this.forgetPending());
    });
  }

  ngOnDestroy(): void {
    this.forgetPending();
  }

  protected choose(blob: Blob): void {
    this.forgetPending();
    this.pending.set({ blob, preview: URL.createObjectURL(blob) });
    this.profileForm.avatar().value.set(CUSTOM_AVATAR);
  }

  /**
   * What the draft says about the picture: one of ours by its id; their own as it is already stored; or, when they just chose one, what
   * they had until it is sent (the picture follows the save, as `upload`).
   */
  private pictureOf(avatar: string): { avatar: string; upload?: Blob } {
    if (avatar !== CUSTOM_AVATAR) {
      return { avatar };
    }
    const upload = this.pending()?.blob;
    return { avatar: avatarOrDefault(this.profile()?.avatar), ...(upload ? { upload } : {}) };
  }

  private forgetPending(): void {
    const pending = this.pending();
    if (pending) {
      URL.revokeObjectURL(pending.preview);
      this.pending.set(null);
    }
  }
}
