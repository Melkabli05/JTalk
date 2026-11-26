import {
  Component,
  computed,
  effect,
  ElementRef,
  input,
  linkedSignal,
  output,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { form, FormField, maxLength, validate } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatRippleModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AvatarSelection, UserProfile } from '../../../../core/models/session.model';
import { trimmedRequired } from '../../../../shared/utils/form-validators';
import { squareJpeg } from '../../../../core/utils/image-resize';
import { AvatarArt } from '../../../../shared/ui/avatar-art/avatar-art';
import {
  PROFILE_LEARN_OPTIONS,
  PROFILE_LOCATION_OPTIONS,
  PROFILE_SPEAK_OPTIONS,
} from '../../constants/profile.constants';
import { ProfileFormSnapshot } from '../../models/profile.model';
import {
  generateUsernameFor,
  isProfileDirty,
  isValidUsername,
  normalizeUsername,
} from '../../utils/profile-validation';

export interface ProfileEditSaveEvent {
  readonly profile: UserProfile;
  readonly avatarBlob?: Blob | null;
}

interface ProfileFormModel {
  name: string;
  username: string;
  speak: string;
  learn: string;
  location: string;
  about: string;
}

function toFormModel(p: UserProfile): ProfileFormModel {
  return {
    name: p.name,
    username: p.username,
    speak: p.speak,
    learn: p.learn,
    location: p.location,
    about: p.about,
  };
}

@Component({
  selector: 'app-profile-edit-form',
  imports: [
    FormField,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatRippleModule,
    MatTooltipModule,
    AvatarArt,
  ],
  templateUrl: './profile-edit-form.html',
  styleUrl: './profile-edit-form.scss',
})
export class ProfileEditForm {
  private readonly aboutTextareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('aboutTextarea');
  private readonly fileInputRef = viewChild<ElementRef<HTMLInputElement>>('avatarFileInput');

  readonly profile = input.required<UserProfile>();
  readonly onboarding = input(false);
  readonly saving = input(false);

  readonly saved = output<ProfileEditSaveEvent>();
  readonly discarded = output<void>();
  readonly avatarPicked = output<void>();
  readonly uploadError = output<string>();

  readonly speakOptions = PROFILE_SPEAK_OPTIONS;
  readonly learnOptions = PROFILE_LEARN_OPTIONS;
  readonly locationOptions = PROFILE_LOCATION_OPTIONS;

  private readonly selectedFile = signal<File | null>(null);
  private readonly encodedAvatar = resource({
    params: () => this.selectedFile() ?? undefined,
    loader: ({ params: file, abortSignal }) => squareJpeg(file, abortSignal),
  });

  readonly pendingAvatarBlob = computed(() =>
    this.encodedAvatar.hasValue() ? this.encodedAvatar.value() : null,
  );
  readonly pendingPreviewUrl = signal<string | null>(null);

  private readonly savedFields = computed(() => this.profile(), {
    equal: (previous, current) =>
      previous.id === current.id &&
      previous.avatar.imageUrl === current.avatar.imageUrl &&
      !isProfileDirty(previous, current),
  });
  readonly selectedAvatar = linkedSignal<AvatarSelection>(() => this.savedFields().avatar);
  readonly model = linkedSignal<ProfileFormModel>(() => toFormModel(this.savedFields()));

  readonly profileForm = form(this.model, (schemaPath) => {
    trimmedRequired(schemaPath.name, 'Display name is required.');
    maxLength(schemaPath.name, 50, { message: 'Use 50 characters or fewer.' });
    validate(schemaPath.username, ({ value }) => {
      const normalized = normalizeUsername(value());
      if (!normalized) {
        return this.onboarding() ? undefined : { kind: 'required', message: 'Enter a username.' };
      }
      return isValidUsername(normalized)
        ? undefined
        : {
            kind: 'pattern',
            message: 'Use 3–30 lowercase letters, numbers, dots, or underscores.',
          };
    });
    maxLength(schemaPath.about, 300, { message: 'Use 300 characters or fewer.' });
  });

  readonly currentSnapshot = computed<ProfileFormSnapshot>(() => {
    const val = this.model();
    return {
      name: val.name,
      username: normalizeUsername(val.username),
      avatar: this.selectedAvatar(),
      speak: val.speak,
      learn: val.learn,
      location: val.location,
      about: val.about,
    };
  });

  readonly dirty = computed(
    () =>
      this.onboarding() ||
      this.pendingAvatarBlob() !== null ||
      isProfileDirty(this.currentSnapshot(), this.savedFields()),
  );

  readonly canSubmit = computed(
    () => !this.saving() && this.dirty() && this.profileForm().valid(),
  );

  readonly aboutLength = computed(() => this.model().about.length);

  readonly previewName = computed(() => this.model().name.trim() || 'Speaker');
  readonly previewHandle = computed(() => normalizeUsername(this.model().username) || 'username');
  readonly previewSpeak = computed(() => this.model().speak);
  readonly previewLearn = computed(() => this.model().learn);
  readonly previewBio = computed(() => this.model().about.trim());

  readonly previewImageUrl = computed(
    () => this.pendingPreviewUrl() ?? this.selectedAvatar().imageUrl ?? null,
  );

  constructor() {
    effect((onCleanup) => {
      const blob = this.pendingAvatarBlob();
      if (!blob) {
        this.pendingPreviewUrl.set(null);
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      untracked(() => {
        this.pendingPreviewUrl.set(objectUrl);
        this.selectedAvatar.set({
          kind: 'own',
          id: 'own',
          bg: '#16121F',
          label: 'Uploaded picture',
          imageUrl: objectUrl,
        });
        this.avatarPicked.emit();
      });
      onCleanup(() => URL.revokeObjectURL(objectUrl));
    });

    effect(() => {
      const err = this.encodedAvatar.error();
      if (!err) return;
      untracked(() => {
        this.selectedFile.set(null);
        this.uploadError.emit(
          err instanceof Error ? err.message : 'Could not process the selected image.',
        );
      });
    });
  }

  generateUsername(): void {
    const generated = generateUsernameFor(this.model().name);
    this.model.update((m) => ({ ...m, username: generated }));
  }

  useDefaultAvatar(): void {
    this.clearPendingAvatar();
    this.selectedAvatar.set({
      kind: 'own',
      id: 'own',
      bg: '#16121F',
      label: 'Default picture',
      imageUrl: null,
    });
    this.avatarPicked.emit();
  }

  triggerAvatarUpload(): void {
    this.fileInputRef()?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const inputEl = event.target instanceof HTMLInputElement ? event.target : null;
    const file = inputEl?.files?.[0];
    if (inputEl) inputEl.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.uploadError.emit('Please select a JPEG or PNG image.');
      return;
    }

    this.selectedFile.set(file);
  }

  clearAbout(): void {
    this.model.update((m) => ({ ...m, about: '' }));
    this.aboutTextareaRef()?.nativeElement.focus();
  }

  onDiscard(): void {
    const p = this.profile();
    this.clearPendingAvatar();
    this.model.set(toFormModel(p));
    this.selectedAvatar.set(p.avatar);
    this.discarded.emit();
  }

  onSave(event?: Event): void {
    event?.preventDefault();
    if (!this.canSubmit()) return;
    const snap = this.currentSnapshot();
    const base = this.profile();
    this.saved.emit({
      profile: {
        ...base,
        name: snap.name.trim() || base.name,
        username: snap.username || base.username,
        avatar: snap.avatar,
        speak: snap.speak,
        learn: snap.learn,
        location: snap.location,
        about: snap.about,
      },
      avatarBlob: this.pendingAvatarBlob(),
    });
  }

  clearPendingAvatar(): void {
    this.selectedFile.set(null);
  }
}
