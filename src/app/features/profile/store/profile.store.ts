import {
  computed,
  inject,
  linkedSignal,
  type ResourceStatus,
  Service,
  type Signal,
  signal,
} from '@angular/core';
import type {
  FollowListResponse,
  UserSummaryResponse,
} from '../../../core/auth/auth.models';
import { IdentityStore } from '../../../core/auth/identity';
import { UsersApi } from '../../../core/auth/users-api';
import { errorMessage } from '../../../core/http/http-error.interceptor';
import { AppStore } from '../../../core/store/app.store';
import {
  PROFILE_CONNECTIONS_PAGE_SIZE,
  PROFILE_MAX_LANGUAGES,
} from '../constants/profile.constants';
import type { ProfileConnectionList } from '../models/profile.model';
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

/**
 * Profile feature store: owns profile connections pagination, language matrix rows,
 * pending unblock/language-mutation flags, and derived profile signals.
 */
@Service({ autoProvided: false })
export class ProfileStore {
  private readonly app = inject(AppStore);
  private readonly identity = inject(IdentityStore);
  private readonly usersApi = inject(UsersApi);

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

  readonly me = this.app.me;
  readonly socialStats = this.app.socialStats;
  readonly profileStatus = this.app.profileStatus;
  readonly meRetrying = this.app.meRetrying;
  readonly profileError = this.app.profileError;
  readonly hasProfile = this.app.hasProfile;
  readonly needsOnboarding = this.app.needsOnboarding;
  readonly savingProfile = this.app.savingProfile;
  readonly deletingAccount = this.app.deletingAccount;
  readonly colorScheme = this.app.colorScheme;
  readonly themePreference = this.app.themePreference;
  readonly canInstall = this.app.canInstall;
  readonly isIosInstallable = this.app.isIosInstallable;
  readonly isInLiveRoom = this.app.inRoom;

  readonly authEmail: Signal<string | null> = computed(() =>
    readAuthString(this.identity.authUser(), 'email'),
  );

  readonly maxLanguages = PROFILE_MAX_LANGUAGES;
  readonly languageRows: Signal<readonly ProfileLanguageRow[]> = computed(() => {
    const me = this.me();
    return me ? buildOrderedLanguageRows(me) : [];
  });
  readonly totalLanguages: Signal<number> = computed(() => this.languageRows().length);

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

  setLanguageBusy(busy: boolean): void {
    this.languageBusyState.set(busy);
  }

  setUnblocking(id: string, busy: boolean): void {
    this.unblockingIdsState.update((prev): ReadonlySet<string> => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  retryConnections(): void {
    this.connectionsRes.reload();
  }

  closeConnections(): void {
    this.connectionsRequest.set(null);
  }

  loadConnections(list: ProfileConnectionList, append = false): void {
    const userId = this.me()?.id;
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
}
