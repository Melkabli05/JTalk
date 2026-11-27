import {
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  type ResourceStatus,
  Service,
  type Signal,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs';
import type {
  FollowListResponse,
  LanguageType,
  ProficiencyLevel,
  ProfileLoadStatus,
  ProfileSaveResult,
  SocialStatsResponse,
  UserProfileResponse,
  UserSummaryResponse,
} from '../../../core/auth/auth.models';
import { IdentityStore } from '../../../core/auth/identity';
import { UsersApi } from '../../../core/auth/users-api';
import { errorMessage } from '../../../core/http/http-error.interceptor';
import {
  type ColorScheme,
  isColorScheme,
  isThemePreference,
  type ThemePreference,
} from '../../../core/models/theme.model';
import { PwaService } from '../../../core/services/pwa';
import { ThemeService } from '../../../core/services/theme';
import { ToastNotifier } from '../../../core/services/toast-notifier';
import { LiveRoomStore } from '../../room/store/live-room-store';
import {
  PROFILE_CONNECTIONS_PAGE_SIZE,
  PROFILE_MAX_LANGUAGES,
} from '../constants/profile.constants';
import type { ProfileConnectionList, ProfileEditSaveEvent } from '../models/profile.model';
import {
  buildOrderedLanguageRows,
  type ProfileLanguageRow,
} from '../utils/profile-format.utils';

interface ConnectionsRequest {
  readonly userId: string;
  readonly list: ProfileConnectionList;
  readonly page: number;
}

function readAuthString(user: unknown, key: string): string | null {
  if (!user || typeof user !== 'object') return null;
  const value: unknown = Reflect.get(user, key);
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

@Service({ autoProvided: false })
export class ProfileFacade {
  private readonly theme = inject(ThemeService);
  private readonly pwa = inject(PwaService);
  private readonly identity = inject(IdentityStore);
  private readonly usersApi = inject(UsersApi);
  private readonly roomStore = inject(LiveRoomStore);
  private readonly toast = inject(ToastNotifier, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  private readonly languageBusyState = signal(false);
  readonly languageBusy: Signal<boolean> = this.languageBusyState.asReadonly();

  private readonly unblockingIdsState = signal<ReadonlySet<string>>(new Set());
  readonly unblockingIds: Signal<ReadonlySet<string>> = this.unblockingIdsState.asReadonly();

  private readonly connectionsRequest = signal<ConnectionsRequest | null>(null);
  private readonly connectionsRes = this.usersApi.connectionsResource(() => {
    const req = this.connectionsRequest();
    return req
      ? { userId: req.userId, list: req.list, page: req.page, size: PROFILE_CONNECTIONS_PAGE_SIZE }
      : undefined;
  });

  readonly me: Signal<UserProfileResponse | null> = this.identity.me;
  readonly socialStats: Signal<SocialStatsResponse | undefined> = this.identity.socialStats;
  readonly profileStatus: Signal<ProfileLoadStatus> = this.identity.profileStatus;
  readonly meRetrying: Signal<boolean> = this.identity.meRetrying;
  readonly profileError: Signal<string | null> = this.identity.profileError;
  readonly hasProfile: Signal<boolean> = this.identity.hasProfile;
  readonly needsOnboarding: Signal<boolean> = this.identity.needsOnboarding;
  readonly savingProfile: Signal<boolean> = this.identity.savingProfile;
  readonly deletingAccount: Signal<boolean> = this.identity.deletingAccount;

  readonly authEmail: Signal<string | null> = computed(() =>
    readAuthString(this.identity.authUser(), 'email'),
  );
  readonly isInLiveRoom: Signal<boolean> = computed(() => this.roomStore.room() !== null);

  readonly maxLanguages = PROFILE_MAX_LANGUAGES;
  readonly languageRows: Signal<readonly ProfileLanguageRow[]> = computed(() => {
    const me = this.me();
    return me ? buildOrderedLanguageRows(me) : [];
  });
  readonly totalLanguages: Signal<number> = computed(() => this.languageRows().length);

  readonly colorScheme: Signal<ColorScheme> = this.theme.colorScheme;
  readonly themePreference: Signal<ThemePreference> = this.theme.preference;
  readonly canInstall: Signal<boolean> = this.pwa.canInstall;
  readonly isIosInstallable: Signal<boolean> = this.pwa.isIosInstallable;

  readonly connectionList: Signal<ProfileConnectionList | null> = computed(
    (): ProfileConnectionList | null => this.connectionsRequest()?.list ?? null,
  );
  readonly connectionsStatus: Signal<ResourceStatus> = this.connectionsRes.status;
  readonly connectionsBusy: Signal<boolean> = this.connectionsRes.isLoading;
  readonly connectionsError: Signal<string | null> = computed((): string | null => {
    const err = this.connectionsRes.error();
    return err ? errorMessage(err, 'Could not load accounts.') : null;
  });

  readonly connections: Signal<readonly UserSummaryResponse[]> = linkedSignal<
    {
      request: ConnectionsRequest | null;
      page: FollowListResponse | UserSummaryResponse[] | undefined;
    },
    readonly UserSummaryResponse[]
  >({
    source: () => ({
      request: this.connectionsRequest(),
      page: this.connectionsRes.hasValue() ? this.connectionsRes.value() : undefined,
    }),
    computation: ({ request, page }, previous) => {
      if (!request) return [];
      if (!page) return request.page > 0 ? (previous?.value ?? []) : [];
      if (previous && page === previous.source.page) return previous.value;
      if (Array.isArray(page)) return page;
      return request.page > 0 ? [...(previous?.value ?? []), ...page.content] : page.content;
    },
  });

  readonly moreConnections: Signal<boolean> = computed((): boolean => {
    if (!this.connectionsRes.hasValue()) return false;
    const page = this.connectionsRes.value();
    return !Array.isArray(page) && (page.page + 1) * page.size < page.total;
  });

  loadMe(): void {
    this.identity.loadMe();
  }

  retryConnections(): void {
    this.connectionsRes.reload();
  }

  closeConnections(): void {
    this.connectionsRequest.set(null);
  }

  loadConnections(list: ProfileConnectionList, append = false): void {
    const userId = this.identity.me()?.id;
    if (!userId) return;

    const current = this.connectionsRequest();
    if (append && (!this.moreConnections() || this.connectionsBusy() || current?.list !== list)) {
      return;
    }
    const previousPage = this.connectionsRes.hasValue() ? this.connectionsRes.value() : undefined;
    const page = append && previousPage && !Array.isArray(previousPage) ? previousPage.page + 1 : 0;
    if (current?.userId === userId && current.list === list && current.page === page) {
      this.connectionsRes.reload();
    } else {
      this.connectionsRequest.set({ userId, list, page });
    }
  }

  unblock(id: string): void {
    if (this.unblockingIdsState().has(id)) return;
    this.unblockingIdsState.update((prev): ReadonlySet<string> => new Set(prev).add(id));
    const clearPending = (): void => {
      this.unblockingIdsState.update((prev): ReadonlySet<string> => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    };
    this.usersApi.unblock(id).subscribe({
      next: () => {
        clearPending();
        if (this.connectionList() === 'blocks') this.loadConnections('blocks');
      },
      error: (err: unknown) => {
        clearPending();
        if (!this.destroyRef.destroyed) {
          this.toast?.show(errorMessage(err, 'Could not unblock account.'));
        }
      },
    });
  }

  changeLanguage(
    code: string,
    type?: LanguageType,
    proficiencyLevel?: ProficiencyLevel,
    onDone?: (ok: boolean, error?: string) => void,
  ): void {
    if (this.languageBusyState()) return;
    this.languageBusyState.set(true);

    const me = this.me();
    const isCurrentlyNative = me?.nativeLanguages.includes(code) ?? false;
    const isCurrentlyLearning =
      me?.learningLanguages.some((entry) => entry.languageCode === code) ?? false;
    const switchingRole =
      (type === 'NATIVE' && isCurrentlyLearning) || (type === 'LEARNING' && isCurrentlyNative);

    const addRequest = () =>
      this.usersApi.addMyLanguage({
        languageCode: code,
        languageType: type ?? 'LEARNING',
        ...(type === 'LEARNING' && proficiencyLevel ? { proficiencyLevel } : {}),
      });

    const req$ = !type
      ? this.usersApi.removeMyLanguage(code)
      : switchingRole
        ? this.usersApi.removeMyLanguage(code).pipe(switchMap(() => addRequest()))
        : addRequest();

    req$.subscribe({
      next: (matrix) => {
        this.languageBusyState.set(false);
        this.identity.applyLanguageMatrix(matrix);
        onDone?.(true);
      },
      error: (err: unknown) => {
        this.languageBusyState.set(false);
        const msg = errorMessage(err, 'Could not update languages.');
        if (!this.destroyRef.destroyed) {
          this.toast?.show(msg);
        }
        onDone?.(false, msg);
      },
    });
  }

  setPrimaryNativeLanguage(code: string): void {
    const current = this.me();
    if (!current || this.languageBusyState() || current.nativeLanguage === code) return;
    this.languageBusyState.set(true);
    this.usersApi.updateMe({ nativeLanguage: code }).subscribe({
      next: (updated) => {
        this.languageBusyState.set(false);
        const merged: UserProfileResponse =
          updated.socialStats !== undefined
            ? updated
            : current.socialStats
              ? { ...updated, socialStats: current.socialStats }
              : updated;
        this.identity.setProfile(merged);
        if (!this.destroyRef.destroyed) {
          this.toast?.show('Primary language updated.');
        }
      },
      error: (err: unknown) => {
        this.languageBusyState.set(false);
        if (!this.destroyRef.destroyed) {
          this.toast?.show(errorMessage(err, 'Could not update primary language.'));
        }
      },
    });
  }

  setThemePreference(value: unknown): void {
    if (isThemePreference(value)) {
      this.theme.setPreference(value);
    }
  }

  setColorScheme(value: unknown): void {
    if (isColorScheme(value)) {
      this.theme.setColorScheme(value);
    }
  }

  promptInstall(): void {
    this.pwa.promptInstall((outcome) => {
      if (outcome === 'accepted' && !this.destroyRef.destroyed) {
        this.toast?.show('Jtalk installed.');
      }
    });
  }

  saveProfile(event: ProfileEditSaveEvent, onResult?: (res: ProfileSaveResult) => void): void {
    const wasOnboarding = this.identity.needsOnboarding();
    this.identity.saveProfile(event.input, event.avatarBlob, (res) => {
      if (this.destroyRef.destroyed) return;
      onResult?.(res);
      if (res.ok) {
        this.toast?.show(wasOnboarding ? 'Profile created.' : 'Profile saved.');
        if (wasOnboarding) {
          void this.router?.navigate(['/rooms']);
        }
      } else {
        this.toast?.show(res.error ?? 'Could not save profile.');
      }
    });
  }

  discardProfile(): void {
    this.toast?.show('Changes discarded.');
  }

  notify(message: string): void {
    this.toast?.show(message);
  }

  signOut(): void {
    this.roomStore.signOut();
  }

  deleteAccount(): void {
    this.identity.deleteAccount((res) => {
      if (res.ok) {
        this.roomStore.rememberRoom(null);
      } else if (res.error && !this.destroyRef.destroyed) {
        this.toast?.show(res.error);
      }
    });
  }
}
