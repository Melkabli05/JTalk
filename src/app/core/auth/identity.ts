import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  PLATFORM_ID,
  Service,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '@auth0/auth0-angular';
import { catchError, finalize, map, type Observable, of, switchMap, throwError } from 'rxjs';
import { ApiError, errorMessage, isAuthSessionError } from '../http/http-error.interceptor';
import { JTALK_USER_ID_CLAIM } from './auth.constants';
import type {
  AccountActionResult,
  CreateProfileRequest,
  LanguageMatrixResponse,
  ProfileLoadStatus,
  ProfileSaveInput,
  ProfileSaveResult,
  SocialStatsResponse,
  UpdateProfileRequest,
  UserProfileResponse,
  UserSummaryResponse,
} from './auth.models';
import { isTransientProfileError, sanitizeReturnUrl } from './auth.utils';
import { UsersApi } from './users-api';
import { SessionExpiryHandler } from '../http/session-expiry';

const ME_RETRY_DELAYS_MS: readonly number[] = [2000, 4000];

function readAuthUserString(user: unknown, key: string): string | null {
  if (!user || typeof user !== 'object') return null;
  const value: unknown = Reflect.get(user, key);
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
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
    ...(trimmedUsername && trimmedUsername !== current.username
      ? { username: trimmedUsername }
      : {}),
    ...(displayName && displayName !== current.displayName ? { displayName } : {}),
    ...(bio !== (current.bio ?? '') ? { bio } : {}),
    ...(nextNative !== current.nativeLanguage ? { nativeLanguage: nextNative } : {}),
    ...(nextLearning !== currentLearning
      ? {
          learningLanguages: [
            ...(nextLearning
              ? [
                  current.learningLanguages.find(
                    (entry) => entry.languageCode === nextLearning,
                  ) ?? {
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService, { optional: true });
  private readonly usersApi = inject(UsersApi);
  private readonly sessionExpiry = inject(SessionExpiryHandler);

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
    return err ? errorMessage(err, 'Sign-in could not be completed. Please try again.') : null;
  });

  private readonly meEnabled = computed(
    () => isPlatformBrowser(this.platformId) && !this.isLoading() && this.isAuthenticated(),
  );
  private readonly meResource = this.usersApi.meResource(() => this.meEnabled());

  private readonly meRetryCount = signal(0);
  private readonly meRetryingState = signal(false);
  readonly meRetrying = this.meRetryingState.asReadonly();
  private meRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private lastRetriedError: unknown = null;

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

  readonly displayNameFallback = computed<string>(() => {
    const profileName = this.me()?.displayName?.trim();
    if (profileName) return profileName;
    const user = this.authUser();
    return (
      readAuthUserString(user, 'name') ??
      readAuthUserString(user, 'nickname') ??
      'Account'
    );
  });

  readonly profileStatus = computed<ProfileLoadStatus>(() => {
    if (this.me() !== null) return 'ready';
    if (!this.isAuthenticated()) return 'unauthenticated';
    if (this.meResource.isLoading() || this.meRetryingState()) return 'loading';
    const err = this.meResource.error();
    if (err instanceof ApiError && err.type === 'urn:jtalk:user:problem:user-not-found') {
      return 'missing';
    }
    return err ? 'error' : 'loading';
  });

  readonly profileError = computed<string | null>(() => {
    if (this.profileStatus() !== 'error') return null;
    const err = this.meResource.error();
    return err ? errorMessage(err, 'Could not load your profile.') : null;
  });

  private readonly savingProfileState = signal(false);
  readonly savingProfile = this.savingProfileState.asReadonly();

  private readonly deletingAccountState = signal(false);
  readonly deletingAccount = this.deletingAccountState.asReadonly();

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

  constructor() {
    let wasAuthenticated = false;
    effect(() => {
      const signedIn = this.isAuthenticated();
      if (wasAuthenticated && !signedIn) {
        this.clearCachedState();
      }
      wasAuthenticated = signedIn;
    });
    effect(() => {
      const err = this.authErrorSignal();
      if (err && isAuthSessionError(err)) {
        this.clearCachedState();
        this.sessionExpiry.handle();
      }
    });
    effect(() => {
      const enabled = this.meEnabled();
      const loaded = this.me() !== null;
      const loading = this.meResource.isLoading();
      const err = this.meResource.error();
      untracked(() => {
        if (!enabled || loaded) {
          this.resetMeRetry();
          return;
        }
        if (loading || !err || err === this.lastRetriedError) return;
        if (!isTransientProfileError(err)) {
          this.cancelMeRetryTimer();
          return;
        }
        const attempt = this.meRetryCount();
        const delay = ME_RETRY_DELAYS_MS[attempt];
        if (delay === undefined) {
          this.meRetryingState.set(false);
          return;
        }
        this.lastRetriedError = err;
        this.meRetryCount.set(attempt + 1);
        this.meRetryingState.set(true);
        this.cancelMeRetryTimer();
        this.meRetryTimer = setTimeout(() => {
          this.meRetryTimer = null;
          this.meRetryingState.set(false);
          if (this.meEnabled() && this.me() === null) {
            this.meResource.reload();
          }
        }, delay);
      });
    });
    this.destroyRef.onDestroy(() => this.cancelMeRetryTimer());
  }

  loadMe(): void {
    this.resetMeRetry();
    if (this.meEnabled()) {
      this.meResource.reload();
    }
  }

  setProfile(profile: UserProfileResponse | null): void {
    this.meState.set(profile);
  }

  applyLanguageMatrix(matrix: LanguageMatrixResponse): void {
    this.meState.update((profile): UserProfileResponse | null =>
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

  saveProfile(
    input: ProfileSaveInput,
    avatarBlob?: Blob | null,
    onDone?: (result: ProfileSaveResult) => void,
  ): void {
    if (this.savingProfileState()) {
      onDone?.({ ok: false, error: 'A profile save is already in progress.' });
      return;
    }
    if (!this.hasProfile() && !this.needsOnboarding()) {
      onDone?.({ ok: false, error: 'Load your profile before making changes.' });
      return;
    }

    this.savingProfileState.set(true);
    const current = this.me();
    const preserveSocialStats = (profile: UserProfileResponse): UserProfileResponse =>
      profile.socialStats !== undefined
        ? profile
        : current?.socialStats
          ? { ...profile, socialStats: current.socialStats }
          : profile;

    const save$ = (
      current ? this.updateExistingProfile(current, input) : this.createInitialProfile(input)
    ).pipe(
      map(preserveSocialStats),
      switchMap((saved) => {
        if (!avatarBlob) return of(saved);
        this.meState.set(saved);
        return this.usersApi.uploadAvatar(avatarBlob).pipe(map(preserveSocialStats));
      }),
      finalize(() => this.savingProfileState.set(false)),
    );

    save$.subscribe({
      next: (saved) => {
        this.meState.set(saved);
        onDone?.({ ok: true, profile: saved });
      },
      error: (err: unknown) => {
        onDone?.({
          ok: false,
          error: errorMessage(err, 'Could not save profile.'),
          ...(err instanceof ApiError ? { errorType: err.type } : {}),
        });
      },
    });
  }

  deleteAccount(onDone?: (result: AccountActionResult) => void): void {
    if (this.deletingAccountState()) {
      onDone?.({ ok: false, error: 'Account deletion is already in progress.' });
      return;
    }
    this.deletingAccountState.set(true);
    this.usersApi
      .deleteMe()
      .pipe(finalize(() => this.deletingAccountState.set(false)))
      .subscribe({
        next: () => {
          this.clearCachedState();
          this.signOut();
          onDone?.({ ok: true });
        },
        error: (err: unknown) => {
          onDone?.({ ok: false, error: errorMessage(err, 'Could not delete account.') });
        },
      });
  }

  signIn(mode: 'login' | 'signup' = 'login', targetPath = '/rooms'): void {
    if (!this.auth || !isPlatformBrowser(this.platformId) || this.isLoading()) return;
    this.sessionExpiry.clear();
    const safeTarget = sanitizeReturnUrl(targetPath, '/rooms');
    const redirect$ = this.auth.loginWithRedirect({
      appState: { target: safeTarget },
      ...(mode === 'signup' ? { authorizationParams: { screen_hint: 'signup' } } : {}),
    });
    redirect$?.subscribe?.({
      error: () => {
        // AuthService publishes redirect failures via auth.error$.
      },
    });
  }

  signOut(): void {
    this.clearCachedState();
    if (!this.auth || !isPlatformBrowser(this.platformId)) return;
    this.auth.logout({ logoutParams: { returnTo: window.location.origin } }).subscribe({
      error: () => window.location.assign('/'),
    });
  }

  private clearCachedState(): void {
    this.resetMeRetry();
    this.meState.set(null);
    this.directoryCache.set(new Map());
    this.inFlightBatchIds.clear();
  }

  private cancelMeRetryTimer(): void {
    if (this.meRetryTimer !== null) {
      clearTimeout(this.meRetryTimer);
      this.meRetryTimer = null;
    }
  }

  private resetMeRetry(): void {
    this.cancelMeRetryTimer();
    this.meRetryCount.set(0);
    this.meRetryingState.set(false);
    this.lastRetriedError = null;
  }

  resolveUsers(ids: readonly string[]): void {
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
      this.usersApi
        .getBatch(chunk)
        .pipe(
          finalize(() => {
            for (const id of chunk) this.inFlightBatchIds.delete(id);
          }),
        )
        .subscribe({
          next: (summaries) => this.mergeUserSummaries(summaries),
          error: () => {
            // Non-fatal: fallback display names remain until the next lookup.
          },
        });
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

  private createInitialProfile(input: ProfileSaveInput): Observable<UserProfileResponse> {
    const trimmedUsername = input.username.trim();
    const learningList =
      input.learningLanguages && input.learningLanguages.length > 0
        ? input.learningLanguages
        : input.learningLanguage
          ? [{ languageCode: input.learningLanguage }]
          : undefined;
    const createReq: CreateProfileRequest = {
      ...(trimmedUsername ? { username: trimmedUsername } : {}),
      displayName: input.displayName.trim(),
      nativeLanguage: input.nativeLanguage,
      ...(learningList ? { learningLanguages: learningList } : {}),
      ...(input.bio.trim() ? { bio: input.bio.trim() } : {}),
      ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.countryCode ? { countryCode: input.countryCode } : {}),
    };
    return this.usersApi.createMe(createReq).pipe(
      catchError((err: unknown) => {
        if (
          err instanceof ApiError &&
          err.type === 'urn:jtalk:user:problem:profile-already-exists'
        ) {
          this.loadMe();
        }
        return throwError(() => err);
      }),
    );
  }

  private updateExistingProfile(
    current: UserProfileResponse,
    input: ProfileSaveInput,
  ): Observable<UserProfileResponse> {
    const patch = buildProfilePatch(current, input);
    return Object.keys(patch).length > 0 ? this.usersApi.updateMe(patch) : of(current);
  }
}
