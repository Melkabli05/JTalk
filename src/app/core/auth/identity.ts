import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  inject,
  linkedSignal,
  PLATFORM_ID,
  Service,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '@auth0/auth0-angular';
import { lastValueFrom } from 'rxjs';
import { ApiError, errorMessage } from '../http/http-error.interceptor';
import type {
  CreateProfileRequest,
  LanguageMatrixResponse,
  ProfileLoadStatus,
  SocialStatsResponse,
  UpdateProfileRequest,
  UserProfileResponse,
  UserSummaryResponse,
} from './auth.models';
import { UsersApi } from './users-api';

export const JTALK_USER_ID_CLAIM = 'https://jtalk.app/user_id';

export interface ProfileSaveInput {
  readonly displayName: string;
  readonly username: string;
  readonly nativeLanguage: string;
  readonly learningLanguage: string | null;
  readonly countryCode: string | null;
  readonly bio: string;
  readonly avatarUrl?: string | null;
}

export interface ProfileSaveResult {
  readonly ok: boolean;
  readonly profile?: UserProfileResponse;
  readonly error?: string;
}

export interface AccountActionResult {
  readonly ok: boolean;
  readonly error?: string;
}

function buildProfilePatch(
  current: UserProfileResponse,
  input: ProfileSaveInput,
): UpdateProfileRequest {
  const currentNativeBase = current.nativeLanguage.split('-')[0]?.toLowerCase() ?? '';
  const nextNative =
    input.nativeLanguage.toLowerCase() === currentNativeBase
      ? current.nativeLanguage
      : input.nativeLanguage;

  const currentLearning = current.learningLanguages[0]?.languageCode ?? null;
  const currentLearningBase = currentLearning?.split('-')[0]?.toLowerCase() ?? null;
  const nextLearning =
    currentLearning && input.learningLanguage?.toLowerCase() === currentLearningBase
      ? currentLearning
      : input.learningLanguage;

  const trimmedUsername = input.username.trim();
  const displayName = input.displayName.trim();
  const bio = input.bio.trim();

  return {
    ...(trimmedUsername && trimmedUsername !== current.username ? { username: trimmedUsername } : {}),
    ...(displayName && displayName !== current.displayName ? { displayName } : {}),
    ...(bio !== (current.bio ?? '') ? { bio } : {}),
    ...(nextNative !== current.nativeLanguage ? { nativeLanguage: nextNative } : {}),
    ...(nextLearning !== currentLearning
      ? {
          learningLanguages: [
            ...(nextLearning
              ? [
                  current.learningLanguages.find((entry) => entry.languageCode === nextLearning) ?? {
                    languageCode: nextLearning,
                  },
                ]
              : []),
            ...current.learningLanguages
              .slice(1)
              .filter(
                (entry) => entry.languageCode !== nextLearning && entry.languageCode !== nextNative,
              ),
          ],
        }
      : {}),
    ...(input.countryCode && input.countryCode !== current.countryCode
      ? { countryCode: input.countryCode }
      : {}),
    ...(input.avatarUrl !== undefined && input.avatarUrl !== current.avatarUrl
      ? { avatarUrl: input.avatarUrl ?? '' }
      : {}),
  };
}

@Service()
export class IdentityStore {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly auth = inject(AuthService, { optional: true });
  private readonly usersApi = inject(UsersApi);

  readonly isLoading = this.auth
    ? toSignal(this.auth.isLoading$, { initialValue: isPlatformBrowser(this.platformId) })
    : signal(false).asReadonly();
  readonly isAuthenticated = this.auth
    ? toSignal(this.auth.isAuthenticated$, { initialValue: false })
    : signal(false).asReadonly();
  readonly authUser = this.auth
    ? toSignal(this.auth.user$, { initialValue: null })
    : signal<null>(null).asReadonly();
  private readonly authErrorSignal = this.auth
    ? toSignal(this.auth.error$, { initialValue: null })
    : signal<null>(null).asReadonly();

  readonly authError = computed<string | null>(() => {
    const err = this.authErrorSignal();
    return err instanceof Error ? err.message : null;
  });

  private readonly meEnabled = computed(
    () => isPlatformBrowser(this.platformId) && !this.isLoading() && this.isAuthenticated(),
  );
  private readonly meResource = this.usersApi.meResource(() => this.meEnabled());

  private readonly meState = linkedSignal<
    { signedIn: boolean; profile: UserProfileResponse | undefined },
    UserProfileResponse | null
  >({
    source: () => ({
      signedIn: this.isAuthenticated(),
      profile: this.meResource.hasValue() ? this.meResource.value() : undefined,
    }),
    computation: ({ signedIn, profile }, previous) => {
      if (!signedIn) return null;
      return profile !== undefined ? profile : (previous?.value ?? null);
    },
  });
  readonly me = this.meState.asReadonly();

  readonly socialStats = computed<SocialStatsResponse | undefined>(
    () => this.me()?.socialStats ?? undefined,
  );

  readonly profileStatus = computed<ProfileLoadStatus>(() => {
    if (!this.isAuthenticated()) return 'unauthenticated';
    if (this.me() !== null) return 'ready';
    if (this.meResource.isLoading()) return 'loading';
    const err = this.meResource.error();
    if (err instanceof ApiError && err.type === 'urn:jtalk:user:problem:user-not-found') {
      return 'missing';
    }
    return err ? 'error' : 'unauthenticated';
  });

  readonly profileError = computed<string | null>(() => {
    if (this.profileStatus() !== 'error') return null;
    const err = this.meResource.error();
    return err ? errorMessage(err, 'Could not load your profile.') : null;
  });

  private readonly savingProfileState = signal(false);
  readonly savingProfile = this.savingProfileState.asReadonly();

  private readonly directoryCache = signal<ReadonlyMap<string, UserSummaryResponse>>(new Map());
  private readonly inFlightBatchIds = new Set<string>();

  readonly userDirectory = computed<ReadonlyMap<string, UserSummaryResponse>>(() => {
    const cache = this.directoryCache();
    const profile = this.me();
    if (!profile) return cache;
    const next = new Map(cache);
    next.set(profile.id, profile);
    return next;
  });

  readonly userId = computed<string | null>(() => {
    const profileId = this.me()?.id;
    if (profileId) return profileId;
    const user = this.authUser();
    const claimId: unknown =
      user && typeof user === 'object' ? Reflect.get(user, JTALK_USER_ID_CLAIM) : null;
    return typeof claimId === 'string' && claimId.length > 0 ? claimId : null;
  });

  readonly hasProfile = computed(() => this.profileStatus() === 'ready' && this.me() !== null);
  readonly needsOnboarding = computed(
    () => this.isAuthenticated() && this.profileStatus() === 'missing',
  );

  loadMe(): void {
    if (this.meEnabled()) {
      this.meResource.reload();
    }
  }

  setProfile(profile: UserProfileResponse | null): void {
    this.meState.set(profile);
  }

  applyLanguageMatrix(matrix: LanguageMatrixResponse): void {
    this.meState.update(
      (profile): UserProfileResponse | null =>
        profile?.id === matrix.userId
          ? {
              ...profile,
              nativeLanguages: matrix.nativeLanguages,
              learningLanguages: matrix.learningLanguages,
            }
          : profile,
    );
  }

  refreshSocialStats(): void {
    this.loadMe();
  }

  async saveProfile(
    input: ProfileSaveInput,
    avatarBlob?: Blob | null,
  ): Promise<ProfileSaveResult> {
    if (this.savingProfileState()) {
      return { ok: false, error: 'A profile save is already in progress.' };
    }
    if (!this.hasProfile() && !this.needsOnboarding()) {
      return { ok: false, error: 'Load your profile before making changes.' };
    }

    this.savingProfileState.set(true);
    try {
      const current = this.me();
      const preserveSocialStats = (profile: UserProfileResponse): UserProfileResponse =>
        profile.socialStats !== undefined
          ? profile
          : current?.socialStats
            ? { ...profile, socialStats: current.socialStats }
            : profile;

      let saved = preserveSocialStats(
        current
          ? await this.updateExistingProfile(current, input)
          : await this.createInitialProfile(input),
      );

      if (avatarBlob) {
        this.meState.set(saved);
        saved = preserveSocialStats(await this.usersApi.uploadAvatar(avatarBlob));
      }

      this.meState.set(saved);
      return { ok: true, profile: saved };
    } catch (err) {
      return { ok: false, error: errorMessage(err, 'Could not save profile.') };
    } finally {
      this.savingProfileState.set(false);
    }
  }

  async deleteAccount(): Promise<AccountActionResult> {
    try {
      await this.usersApi.deleteMe();
      this.meState.set(null);
      await this.signOut();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err, 'Could not delete account.') };
    }
  }

  signIn(mode: 'login' | 'signup' = 'login', targetPath = '/rooms'): void {
    if (!this.auth || !isPlatformBrowser(this.platformId)) return;
    this.auth.loginWithRedirect({
      appState: { target: targetPath },
      ...(mode === 'signup' ? { authorizationParams: { screen_hint: 'signup' } } : {}),
    });
  }

  async signOut(): Promise<void> {
    if (!this.auth || !isPlatformBrowser(this.platformId)) return;
    try {
      await lastValueFrom(this.auth.logout({ logoutParams: { returnTo: window.location.origin } }));
    } catch {
      window.location.assign('/');
    }
  }

  async resolveUsers(ids: readonly string[]): Promise<void> {
    if (!this.isAuthenticated() || ids.length === 0) return;

    const currentMap = this.userDirectory();
    const missing = Array.from(
      new Set(ids.filter((id) => id && !currentMap.has(id) && !this.inFlightBatchIds.has(id))),
    );
    if (missing.length === 0) return;

    for (const id of missing) {
      this.inFlightBatchIds.add(id);
    }

    for (let i = 0; i < missing.length; i += 500) {
      const chunk = missing.slice(i, i + 500);
      try {
        this.mergeUserSummaries(await this.usersApi.getBatch(chunk));
      } catch {
        // Non-fatal: fallback display names remain until the next lookup.
      } finally {
        for (const id of chunk) this.inFlightBatchIds.delete(id);
      }
    }
  }

  mergeUserSummaries(summaries: readonly UserSummaryResponse[]): void {
    if (summaries.length === 0) return;
    this.directoryCache.update((existing): ReadonlyMap<string, UserSummaryResponse> => {
      const next = new Map(existing);
      for (const user of summaries) next.set(user.id, user);
      return next;
    });
  }

  updateCachedAvatar(userId: string, avatarUrl: string): void {
    if (this.me()?.id === userId) {
      this.meState.update((profile): UserProfileResponse | null =>
        profile ? { ...profile, avatarUrl } : profile,
      );
    }
    this.directoryCache.update((existing): ReadonlyMap<string, UserSummaryResponse> => {
      const current = existing.get(userId);
      if (!current) return existing;
      return new Map(existing).set(userId, { ...current, avatarUrl });
    });
  }

  private async createInitialProfile(input: ProfileSaveInput): Promise<UserProfileResponse> {
    const trimmedUsername = input.username.trim();
    const createReq: CreateProfileRequest = {
      ...(trimmedUsername ? { username: trimmedUsername } : {}),
      displayName: input.displayName.trim(),
      nativeLanguage: input.nativeLanguage,
      ...(input.learningLanguage
        ? { learningLanguages: [{ languageCode: input.learningLanguage }] }
        : {}),
      ...(input.bio.trim() ? { bio: input.bio.trim() } : {}),
      ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.countryCode ? { countryCode: input.countryCode } : {}),
    };
    try {
      return await this.usersApi.createMe(createReq);
    } catch (err) {
      if (err instanceof ApiError && err.type === 'urn:jtalk:user:problem:profile-already-exists') {
        this.loadMe();
      }
      throw err;
    }
  }

  private updateExistingProfile(
    current: UserProfileResponse,
    input: ProfileSaveInput,
  ): Promise<UserProfileResponse> {
    const patch = buildProfilePatch(current, input);
    return Object.keys(patch).length > 0 ? this.usersApi.updateMe(patch) : Promise.resolve(current);
  }
}
