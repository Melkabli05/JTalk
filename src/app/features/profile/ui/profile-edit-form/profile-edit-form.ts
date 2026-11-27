import {
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
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
import type { SocialStatsResponse, UserProfileResponse } from '../../../../core/auth/auth.models';
import type { ProfileSaveInput } from '../../../../core/auth/identity';
import {
  COUNTRY_CATALOG,
  LANGUAGE_CATALOG,
  languageNameFor,
} from '../../../../core/utils/language-codes';
import { AvatarArt } from '../../../../shared/ui/avatar-art/avatar-art';
import { trimmedRequired } from '../../../../shared/utils/form-validators';

export interface ProfileEditSaveEvent {
  readonly input: ProfileSaveInput;
  readonly avatarBlob: Blob | null;
}

interface ProfileFormModel {
  displayName: string;
  username: string;
  nativeLanguage: string;
  learningLanguage: string;
  countryCode: string;
  bio: string;
}

const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;
const MAX_AVATAR_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES: ReadonlySet<string> = new Set(['image/jpeg', 'image/png']);

function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

function toFormModel(p: UserProfileResponse | null): ProfileFormModel {
  if (!p) {
    return {
      displayName: '',
      username: '',
      nativeLanguage: 'en',
      learningLanguage: 'es',
      countryCode: '',
      bio: '',
    };
  }
  return {
    displayName: p.displayName,
    username: p.username,
    nativeLanguage: p.nativeLanguage.split('-')[0]?.toLowerCase() || 'en',
    learningLanguage: p.learningLanguages[0]?.languageCode.split('-')[0]?.toLowerCase() ?? '',
    countryCode: p.countryCode?.toUpperCase() ?? '',
    bio: p.bio ?? '',
  };
}

function modelsEqual(a: ProfileFormModel, b: ProfileFormModel): boolean {
  return (
    a.displayName.trim() === b.displayName.trim() &&
    normalizeUsername(a.username) === normalizeUsername(b.username) &&
    a.nativeLanguage === b.nativeLanguage &&
    a.learningLanguage === b.learningLanguage &&
    a.countryCode === b.countryCode &&
    a.bio.trim() === b.bio.trim()
  );
}

function formatJoinedMonth(isoDate: string | undefined): string {
  if (!isoDate) return '';
  const parsed = new Date(isoDate);
  return Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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
    AvatarArt,
  ],
  templateUrl: './profile-edit-form.html',
  styleUrl: './profile-edit-form.scss',
})
export class ProfileEditForm {
  private readonly aboutTextareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('aboutTextarea');
  private readonly fileInputRef = viewChild<ElementRef<HTMLInputElement>>('avatarFileInput');

  readonly profile = input<UserProfileResponse | null>(null);
  readonly stats = input<SocialStatsResponse | null>(null);
  readonly onboarding = input(false);
  readonly saving = input(false);

  readonly saved = output<ProfileEditSaveEvent>();
  readonly discarded = output<void>();
  readonly avatarPicked = output<void>();
  readonly uploadError = output<string>();

  readonly languages = LANGUAGE_CATALOG;
  readonly countries = COUNTRY_CATALOG;

  private readonly selectedFile = signal<File | null>(null);
  readonly pendingAvatarBlob = this.selectedFile.asReadonly();
  readonly pendingPreviewUrl = signal<string | null>(null);

  private readonly savedModel = computed(() => toFormModel(this.profile()), { equal: modelsEqual });
  readonly model = linkedSignal<ProfileFormModel>(() => ({ ...this.savedModel() }));

  readonly profileForm = form(this.model, (schemaPath) => {
    trimmedRequired(schemaPath.displayName, 'Display name is required.');
    maxLength(schemaPath.displayName, 50, { message: 'Use 50 characters or fewer.' });
    validate(schemaPath.username, ({ value }) => {
      const normalized = normalizeUsername(value());
      if (!normalized) {
        return this.onboarding() ? undefined : { kind: 'required', message: 'Enter a username.' };
      }
      return USERNAME_PATTERN.test(normalized)
        ? undefined
        : {
            kind: 'pattern',
            message: 'Use 3–30 lowercase letters, numbers, dots, or underscores.',
          };
    });
    validate(schemaPath.learningLanguage, ({ value }) => {
      const learn = value();
      return learn && learn === this.model().nativeLanguage
        ? {
            kind: 'conflict',
            message: 'Choose a different language from the one you speak.',
          }
        : undefined;
    });
    maxLength(schemaPath.bio, 300, { message: 'Use 300 characters or fewer.' });
  });

  readonly dirty = computed(
    () =>
      this.onboarding() ||
      this.pendingAvatarBlob() !== null ||
      !modelsEqual(this.model(), this.savedModel()),
  );

  readonly canSubmit = computed(
    () => !this.saving() && this.dirty() && this.profileForm().valid(),
  );

  readonly aboutLength = computed(() => this.model().bio.length);
  readonly previewName = computed(() => this.model().displayName.trim() || 'Speaker');
  readonly previewHandle = computed(() => normalizeUsername(this.model().username) || 'username');
  readonly previewSpeak = computed(() => languageNameFor(this.model().nativeLanguage));
  readonly previewLearn = computed(() =>
    this.model().learningLanguage ? languageNameFor(this.model().learningLanguage) : null,
  );
  readonly previewBio = computed(() => this.model().bio.trim());
  readonly joinedLabel = computed(() => formatJoinedMonth(this.profile()?.createdAt));
  readonly previewImageUrl = computed(
    () => this.pendingPreviewUrl() ?? this.profile()?.avatarUrl ?? null,
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revokePreviewUrl());
  }

  triggerAvatarUpload(): void {
    this.fileInputRef()?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const inputEl = event.target instanceof HTMLInputElement ? event.target : null;
    const file = inputEl?.files?.[0];
    if (inputEl) inputEl.value = '';
    if (!file) return;

    if (!ACCEPTED_AVATAR_TYPES.has(file.type)) {
      this.uploadError.emit('Please select a JPEG or PNG image.');
      return;
    }

    if (file.size === 0 || file.size > MAX_AVATAR_UPLOAD_BYTES) {
      this.uploadError.emit('The picture must be at most 5 MB.');
      return;
    }

    this.setAvatarFile(file);
  }

  clearAbout(): void {
    this.model.update((m) => ({ ...m, bio: '' }));
    this.aboutTextareaRef()?.nativeElement.focus();
  }

  onDiscard(): void {
    this.clearPendingAvatar();
    this.model.set({ ...this.savedModel() });
    this.discarded.emit();
  }

  onSave(event?: Event): void {
    event?.preventDefault();
    if (!this.canSubmit()) return;
    const val = this.model();
    this.saved.emit({
      input: {
        displayName: val.displayName.trim(),
        username: normalizeUsername(val.username),
        nativeLanguage: val.nativeLanguage,
        learningLanguage: val.learningLanguage || null,
        countryCode: val.countryCode || null,
        bio: val.bio,
      },
      avatarBlob: this.pendingAvatarBlob(),
    });
  }

  clearPendingAvatar(): void {
    this.setAvatarFile(null);
  }

  private setAvatarFile(file: File | null): void {
    this.revokePreviewUrl();
    this.selectedFile.set(file);
    if (!file) {
      this.pendingPreviewUrl.set(null);
      return;
    }
    this.pendingPreviewUrl.set(URL.createObjectURL(file));
    this.avatarPicked.emit();
  }

  private revokePreviewUrl(): void {
    const existing = this.pendingPreviewUrl();
    if (existing) {
      URL.revokeObjectURL(existing);
    }
  }
}
