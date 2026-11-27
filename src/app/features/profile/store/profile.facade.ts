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
import { toSignal } from '@angular/core/rxjs-interop';
import { form } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import type {
  FollowListResponse,
  LanguageType,
  ProficiencyLevel,
  SocialStatsResponse,
  UserProfileResponse,
  UserSummaryResponse,
} from '../../../core/auth/auth.models';
import { IdentityStore } from '../../../core/auth/identity';
import { UsersApi } from '../../../core/auth/users-api';
import { errorMessage } from '../../../core/http/http-error.interceptor';
import { type ColorScheme, isColorScheme } from '../../../core/models/theme.model';
import { PwaService } from '../../../core/services/pwa';
import { ThemeService } from '../../../core/services/theme';
import { ToastNotifier } from '../../../core/services/toast-notifier';
import { LiveRoomStore } from '../../room/store/live-room-store';
import {
  parseProfileTab,
  PROFILE_CONNECTIONS_PAGE_SIZE,
  PROFILE_TAB_ORDER,
  type ProfileTab,
} from '../constants/profile.constants';
import type { ProfileConnectionList, ProfileEditSaveEvent } from '../models/profile.model';

interface ConnectionsRequest {
  readonly userId: string;
  readonly list: ProfileConnectionList;
  readonly page: number;
}

interface AddLanguageFormModel {
  code: string;
  level: ProficiencyLevel;
}

@Service({ autoProvided: false })
export class ProfileFacade {
  private readonly theme = inject(ThemeService);
  private readonly pwa = inject(PwaService);
  private readonly identity = inject(IdentityStore);
  private readonly usersApi = inject(UsersApi);
  private readonly roomStore = inject(LiveRoomStore);
  private readonly toast = inject(ToastNotifier, { optional: true });
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  private readonly queryParams = this.route
    ? toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap })
    : null;

  private readonly addLanguageModel = signal<AddLanguageFormModel>({
    code: 'en',
    level: 'BEGINNER',
  });
  readonly addLanguageForm = form(this.addLanguageModel);

  private readonly editingLanguagesState = signal(false);
  readonly editingLanguages: Signal<boolean> = this.editingLanguagesState.asReadonly();

  private readonly languageBusyState = signal(false);
  readonly languageBusy: Signal<boolean> = this.languageBusyState.asReadonly();

  private readonly connectionsRequest = signal<ConnectionsRequest | null>(null);
  private readonly connectionsRes = this.usersApi.connectionsResource(() => {
    const req = this.connectionsRequest();
    return req
      ? { userId: req.userId, list: req.list, page: req.page, size: PROFILE_CONNECTIONS_PAGE_SIZE }
      : undefined;
  });

  readonly me: Signal<UserProfileResponse | null> = this.identity.me;
  readonly socialStats: Signal<SocialStatsResponse | undefined> = this.identity.socialStats;
  readonly profileError: Signal<string | null> = this.identity.profileError;
  readonly hasProfile: Signal<boolean> = this.identity.hasProfile;
  readonly needsOnboarding: Signal<boolean> = this.identity.needsOnboarding;
  readonly savingProfile: Signal<boolean> = this.identity.savingProfile;

  readonly colorScheme: Signal<ColorScheme> = this.theme.colorScheme;
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

  private readonly activeTabState = linkedSignal<ProfileTab>(
    () =>
      parseProfileTab(this.queryParams?.().get('tab') ?? null) ??
      (this.identity.needsOnboarding() ? 'edit' : 'overview'),
  );
  readonly activeTab: Signal<ProfileTab> = this.activeTabState.asReadonly();

  readonly selectedTabIndex: Signal<number> = computed((): number => {
    const idx = PROFILE_TAB_ORDER.indexOf(this.activeTab());
    return idx === -1 ? 0 : idx;
  });

  loadMe(): void {
    this.identity.loadMe();
  }

  toggleEditingLanguages(): void {
    this.editingLanguagesState.update((v): boolean => !v);
  }

  retryConnections(): void {
    this.connectionsRes.reload();
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
    this.usersApi.unblock(id).subscribe({
      next: () => {
        if (this.connectionList() === 'blocks') this.loadConnections('blocks');
      },
      error: (err: unknown) => {
        if (!this.destroyRef.destroyed) {
          this.toast?.show(errorMessage(err, 'Could not unblock account.'));
        }
      },
    });
  }

  changeLanguage(code: string, type?: LanguageType, proficiencyLevel?: ProficiencyLevel): void {
    if (this.languageBusyState()) return;
    this.languageBusyState.set(true);
    const req$ = type
      ? this.usersApi.addMyLanguage({
          languageCode: code,
          languageType: type,
          ...(type === 'LEARNING' && proficiencyLevel ? { proficiencyLevel } : {}),
        })
      : this.usersApi.removeMyLanguage(code);
    req$.subscribe({
      next: (matrix) => {
        this.languageBusyState.set(false);
        this.identity.applyLanguageMatrix(matrix);
      },
      error: (err: unknown) => {
        this.languageBusyState.set(false);
        if (!this.destroyRef.destroyed) {
          this.toast?.show(errorMessage(err, 'Could not update languages.'));
        }
      },
    });
  }

  selectTab(tab: ProfileTab): void {
    this.activeTabState.set(tab);
    if (this.router && this.route) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab: tab === 'overview' ? null : tab },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  selectTabIndex(index: number): void {
    this.selectTab(PROFILE_TAB_ORDER[index] ?? 'overview');
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

  saveProfile(event: ProfileEditSaveEvent, onSaved?: () => void): void {
    const wasOnboarding = this.identity.needsOnboarding();
    this.identity.saveProfile(event.input, event.avatarBlob, (res) => {
      if (this.destroyRef.destroyed) return;
      if (res.ok) {
        onSaved?.();
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
