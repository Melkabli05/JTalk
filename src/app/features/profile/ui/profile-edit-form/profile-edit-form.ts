import {
  Component,
  computed,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { form, FormField, maxLength, validate } from '@angular/forms/signals';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { type ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type {
  LearningLanguageEntry,
  ProficiencyLevel,
  SocialStatsResponse,
  UserProfileResponse,
} from '../../../../core/auth/auth.models';
import { COUNTRY_CATALOG, LANGUAGE_CATALOG } from '../../../../core/utils/language-codes';
import { trimmedRequired } from '../../../../shared/utils/form-validators';
import {
  PROFILE_AVATAR_ACCEPTED_TYPES,
  PROFILE_AVATAR_MAX_BYTES,
  PROFILE_BIO_MAX,
  PROFILE_DISPLAY_NAME_MAX,
  PROFILE_MAX_LANGUAGES,
  PROFILE_USERNAME_PATTERN,
} from '../../constants/profile.constants';
import type {
  ProfileEditSaveEvent,
  ProfileServerFieldErrors,
} from '../../models/profile.model';
import {
  buildOrderedLanguageRows,
  countryFlagCodeFor,
  displayCountryName,
  displayLanguageName,
  languageBaseCode,
  normalizeUsername,
  profileInitials,
  type ProfileLanguageRow,
} from '../../utils/profile-format.utils';
import { LanguageList } from '../language-list/language-list';
import { ProfileHeader } from '../profile-header/profile-header';
import { ProfileSaveBar } from '../profile-save-bar/profile-save-bar';

interface ProfileFormModel {
  displayName: string;
  username: string;
  nativeLanguage: string;
  countryCode: string;
  bio: string;
}

interface CountryOption {
  readonly code: string;
  readonly name: string;
  readonly flagCode: string;
  readonly searchText: string;
}

const COUNTRY_OPTIONS: readonly CountryOption[] = COUNTRY_CATALOG.map((entry) => {
  const name = displayCountryName(entry.code) || entry.name;
  return {
    code: entry.code,
    name,
    flagCode: entry.flagCode,
    searchText: `${name} ${entry.name} ${entry.code}`.toLowerCase(),
  };
}).sort((a, b) => a.name.localeCompare(b.name));

function toFormModel(p: UserProfileResponse | null): ProfileFormModel {
  if (!p) {
    return {
      displayName: '',
      username: '',
      nativeLanguage: 'en',
      countryCode: '',
      bio: '',
    };
  }
  return {
    displayName: p.displayName,
    username: p.username,
    nativeLanguage: p.nativeLanguage || 'en',
    countryCode: p.countryCode?.toUpperCase() ?? '',
    bio: p.bio ?? '',
  };
}

function modelsEqual(a: ProfileFormModel, b: ProfileFormModel): boolean {
  return (
    a.displayName.trim() === b.displayName.trim() &&
    normalizeUsername(a.username) === normalizeUsername(b.username) &&
    a.nativeLanguage === b.nativeLanguage &&
    a.countryCode === b.countryCode &&
    a.bio.trim() === b.bio.trim()
  );
}

@Component({
  selector: 'app-profile-edit-form',
  imports: [
    FormField,
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    LanguageList,
    ProfileHeader,
    ProfileSaveBar,
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
  readonly languageBusy = input(false);
  readonly isLive = input(false);
  readonly serverErrors = input<ProfileServerFieldErrors>({});
  readonly focusSection = input<string | null>(null);

  readonly saved = output<ProfileEditSaveEvent>();
  readonly discarded = output<void>();
  readonly avatarPicked = output<void>();
  readonly cropFileRequested = output<File>();
  readonly uploadError = output<string>();
  readonly serverErrorCleared = output<'username' | 'avatar' | 'languages'>();
  readonly addLanguageRequested = output<void>();
  readonly editLanguageRequested = output<ProfileLanguageRow>();
  readonly removeLanguageRequested = output<ProfileLanguageRow>();
  readonly setPrimaryLanguageRequested = output<ProfileLanguageRow>();

  readonly languages = LANGUAGE_CATALOG;
  readonly displayNameMax = PROFILE_DISPLAY_NAME_MAX;
  readonly bioMax = PROFILE_BIO_MAX;
  readonly maxLanguages = PROFILE_MAX_LANGUAGES;
  readonly displayLangName = displayLanguageName;

  private readonly selectedBlob = signal<Blob | null>(null);
  readonly pendingAvatarBlob = this.selectedBlob.asReadonly();
  readonly pendingPreviewUrl = signal<string | null>(null);
  private readonly avatarFailedUrl = signal<string | null>(null);

  // Onboarding-only local learning languages submitted in POST /api/v1/users/me.
  readonly onboardingLearning = signal<readonly LearningLanguageEntry[]>([]);

  private readonly savedModel = computed(() => toFormModel(this.profile()), { equal: modelsEqual });
  readonly model = linkedSignal<ProfileFormModel>(() => ({ ...this.savedModel() }));

  readonly countryQuery = linkedSignal<string>(() => {
    const code = this.model().countryCode;
    return code ? displayCountryName(code) : '';
  });

  readonly filteredCountries = computed<readonly CountryOption[]>(() => {
    const q = this.countryQuery().trim().toLowerCase();
    const currentName = this.model().countryCode
      ? displayCountryName(this.model().countryCode).toLowerCase()
      : '';
    if (!q || q === currentName) {
      return COUNTRY_OPTIONS.slice(0, 60);
    }
    return COUNTRY_OPTIONS.filter((opt) => opt.searchText.includes(q)).slice(0, 40);
  });

  readonly selectedCountryFlag = computed(() => countryFlagCodeFor(this.model().countryCode));
  readonly canClearCountry = computed(() => !this.profile()?.countryCode);

  readonly profileForm = form(this.model, (schemaPath) => {
    trimmedRequired(schemaPath.displayName, 'Display name is required.');
    maxLength(schemaPath.displayName, PROFILE_DISPLAY_NAME_MAX, {
      message: `Use ${PROFILE_DISPLAY_NAME_MAX} characters or fewer.`,
    });
    validate(schemaPath.username, ({ value }) => {
      const serverErr = this.serverErrors().username;
      if (serverErr) {
        return { kind: 'server', message: serverErr };
      }
      const normalized = normalizeUsername(value());
      if (!normalized) {
        return this.onboarding() ? undefined : { kind: 'required', message: 'Enter a username.' };
      }
      return PROFILE_USERNAME_PATTERN.test(normalized)
        ? undefined
        : {
            kind: 'pattern',
            message: 'Use 3–30 lowercase letters, numbers, dots, or underscores.',
          };
    });
    maxLength(schemaPath.bio, PROFILE_BIO_MAX, {
      message: `Use ${PROFILE_BIO_MAX} characters or fewer.`,
    });
  });

  readonly usernameErrorMatcher: ErrorStateMatcher = {
    isErrorState: (control) => {
      if (this.serverErrors().username) return true;
      return Boolean(control?.invalid && (control.touched || control.dirty));
    },
  };

  readonly dirty = computed(
    () =>
      this.onboarding() ||
      this.pendingAvatarBlob() !== null ||
      !modelsEqual(this.model(), this.savedModel()),
  );

  readonly canSubmit = computed(() => !this.saving() && this.dirty() && this.profileForm().valid());

  readonly aboutLength = computed(() => this.model().bio.length);
  readonly displayNameLength = computed(() => this.model().displayName.length);
  readonly previewName = computed(() => this.model().displayName.trim() || 'Speaker');
  readonly previewInitials = computed(() => profileInitials(this.previewName()));
  readonly previewBio = computed(() => this.model().bio.trim());
  readonly previewImageUrl = computed(() => {
    const raw = this.pendingPreviewUrl() ?? this.profile()?.avatarUrl ?? null;
    if (!raw || raw === this.avatarFailedUrl()) return null;
    return raw;
  });

  readonly languageRows = computed<readonly ProfileLanguageRow[]>(() => {
    const current = this.profile();
    if (!this.onboarding() && current) {
      return buildOrderedLanguageRows(current);
    }
    const nativeCode = this.model().nativeLanguage || 'en';
    const filteredLearning = this.onboardingLearning().filter(
      (entry) => languageBaseCode(entry.languageCode) !== languageBaseCode(nativeCode),
    );
    return buildOrderedLanguageRows({
      nativeLanguage: nativeCode,
      nativeLanguages: [nativeCode],
      learningLanguages: filteredLearning,
    });
  });

  readonly previewProfile = computed<UserProfileResponse>(() => {
    const base = this.profile();
    const val = this.model();
    const nativeCode = this.onboarding()
      ? val.nativeLanguage
      : (base?.nativeLanguage ?? val.nativeLanguage);
    return {
      id: base?.id ?? 'preview',
      displayName: this.previewName(),
      username: normalizeUsername(val.username) || (base?.username ?? ''),
      bio: val.bio.trim() || null,
      avatarUrl: this.previewImageUrl(),
      countryCode: val.countryCode || null,
      nativeLanguage: nativeCode,
      nativeLanguages: this.onboarding() ? [nativeCode] : (base?.nativeLanguages ?? [nativeCode]),
      learningLanguages: this.onboarding()
        ? this.onboardingLearning()
        : (base?.learningLanguages ?? []),
      createdAt: base?.createdAt ?? '',
    };
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revokePreviewUrl());

    effect(() => {
      if (this.focusSection() === 'bio') {
        queueMicrotask(() => {
          const el = this.aboutTextareaRef()?.nativeElement;
          if (!el) return;
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus({ preventScroll: true });
        });
      }
    });
  }

  triggerAvatarUpload(): void {
    this.fileInputRef()?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const inputEl = event.target instanceof HTMLInputElement ? event.target : null;
    const file = inputEl?.files?.[0];
    if (inputEl) inputEl.value = '';
    if (!file) return;

    if (!PROFILE_AVATAR_ACCEPTED_TYPES.has(file.type)) {
      this.uploadError.emit('Please select a JPEG or PNG image.');
      return;
    }

    if (file.size === 0 || file.size > PROFILE_AVATAR_MAX_BYTES) {
      this.uploadError.emit('The picture must be at most 5 MB.');
      return;
    }

    this.serverErrorCleared.emit('avatar');
    this.cropFileRequested.emit(file);
  }

  applyCroppedAvatar(blob: Blob, previewUrl?: string): void {
    this.revokePreviewUrl();
    this.avatarFailedUrl.set(null);
    this.selectedBlob.set(blob);
    this.pendingPreviewUrl.set(previewUrl ?? URL.createObjectURL(blob));
    this.avatarPicked.emit();
  }

  clearPendingAvatar(): void {
    this.revokePreviewUrl();
    this.selectedBlob.set(null);
    this.pendingPreviewUrl.set(null);
  }

  onAvatarImageError(url: string): void {
    this.avatarFailedUrl.set(url);
  }

  onUsernameInput(): void {
    if (this.serverErrors().username) {
      this.serverErrorCleared.emit('username');
    }
  }

  onCountryInput(event: Event): void {
    const value = event.target instanceof HTMLInputElement ? event.target.value : '';
    this.countryQuery.set(value);
    const trimmed = value.trim();
    if (!trimmed && this.canClearCountry()) {
      this.model.update((m) => ({ ...m, countryCode: '' }));
      return;
    }
    const lower = trimmed.toLowerCase();
    const exact = COUNTRY_OPTIONS.find(
      (opt) => opt.name.toLowerCase() === lower || opt.code.toLowerCase() === lower,
    );
    if (exact) {
      this.model.update((m) => ({ ...m, countryCode: exact.code }));
    }
  }

  onCountrySelected(code: string): void {
    this.model.update((m) => ({ ...m, countryCode: code }));
    this.countryQuery.set(code ? displayCountryName(code) : '');
  }

  onCountryBlur(): void {
    const current = this.model().countryCode;
    this.countryQuery.set(current ? displayCountryName(current) : '');
  }

  onOnboardingNativeChange(code: string): void {
    this.model.update((m) => ({ ...m, nativeLanguage: code }));
    const base = languageBaseCode(code);
    this.onboardingLearning.update((list) =>
      list.filter((entry) => languageBaseCode(entry.languageCode) !== base),
    );
  }

  upsertOnboardingLearning(code: string, level: ProficiencyLevel): void {
    const normalized = code.trim();
    if (!normalized) return;
    if (languageBaseCode(normalized) === languageBaseCode(this.model().nativeLanguage)) return;
    this.onboardingLearning.update((list) => {
      const idx = list.findIndex(
        (entry) => languageBaseCode(entry.languageCode) === languageBaseCode(normalized),
      );
      const next: LearningLanguageEntry = { languageCode: normalized, proficiencyLevel: level };
      if (idx >= 0) {
        return list.map((item, i) => (i === idx ? next : item));
      }
      if (list.length + 1 >= PROFILE_MAX_LANGUAGES) return list;
      return [...list, next];
    });
  }

  removeOnboardingLearning(code: string): void {
    const base = languageBaseCode(code);
    this.onboardingLearning.update((list) =>
      list.filter((entry) => languageBaseCode(entry.languageCode) !== base),
    );
  }

  onRemoveLanguageRow(row: ProfileLanguageRow): void {
    if (this.onboarding()) {
      this.removeOnboardingLearning(row.code);
      return;
    }
    this.removeLanguageRequested.emit(row);
  }

  clearAbout(): void {
    this.model.update((m) => ({ ...m, bio: '' }));
    this.aboutTextareaRef()?.nativeElement.focus();
  }

  onDiscard(): void {
    this.clearPendingAvatar();
    this.model.set({ ...this.savedModel() });
    this.countryQuery.set(
      this.savedModel().countryCode ? displayCountryName(this.savedModel().countryCode) : '',
    );
    this.serverErrorCleared.emit('username');
    this.serverErrorCleared.emit('avatar');
    this.discarded.emit();
  }

  onSave(event?: Event): void {
    event?.preventDefault();
    if (!this.canSubmit()) return;
    const val = this.model();
    const current = this.profile();
    const isOnboarding = this.onboarding();
    const learningEntries = isOnboarding ? this.onboardingLearning() : undefined;
    const primaryLearning = isOnboarding
      ? (learningEntries?.[0]?.languageCode ?? null)
      : (current?.learningLanguages[0]?.languageCode ?? null);

    this.saved.emit({
      input: {
        displayName: val.displayName.trim(),
        username: normalizeUsername(val.username),
        nativeLanguage: isOnboarding ? val.nativeLanguage : (current?.nativeLanguage ?? val.nativeLanguage),
        learningLanguage: primaryLearning,
        ...(isOnboarding && learningEntries && learningEntries.length > 0
          ? { learningLanguages: learningEntries }
          : {}),
        countryCode: val.countryCode || null,
        bio: val.bio,
      },
      avatarBlob: this.pendingAvatarBlob(),
    });
  }

  private revokePreviewUrl(): void {
    const existing = this.pendingPreviewUrl();
    if (existing?.startsWith('blob:')) {
      URL.revokeObjectURL(existing);
    }
  }
}
