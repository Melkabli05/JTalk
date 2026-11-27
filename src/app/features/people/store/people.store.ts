import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  debounced,
  effect,
  inject,
  linkedSignal,
  PLATFORM_ID,
  type ResourceStatus,
  Service,
  type Signal,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import type { DiscoveredUserResponse, UserPageResponse } from '../../../core/auth/auth.models';
import { IdentityStore } from '../../../core/auth/identity';
import { UsersApi } from '../../../core/auth/users-api';
import { ApiError, errorMessage } from '../../../core/http/http-error.interceptor';
import { overlayUserSummary } from '../../../shared/utils/user-summary.utils';
import {
  PEOPLE_MATCHMAKING_PAGE_SIZE,
  PEOPLE_MIN_SEARCH_LENGTH,
  PEOPLE_SEARCH_DEBOUNCE_MS,
} from '../constants/people.constants';

/**
 * People feature store: owns matchmaking pagination, debounced search,
 * optimistic follow/block overrides, and directory synchronization.
 */
@Service({ autoProvided: false })
export class PeopleStore {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly usersApi = inject(UsersApi);
  private readonly identity = inject(IdentityStore);
  private readonly route = inject(ActivatedRoute, { optional: true });

  private readonly queryParamMap = this.route
    ? toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap })
    : null;

  private readonly cursor = linkedSignal<
    boolean,
    { afterCreatedAt: string; afterId: string } | null
  >({
    source: () => this.identity.isAuthenticated(),
    computation: () => null,
  });

  private readonly matches = this.usersApi.matchmakingResource(() =>
    isPlatformBrowser(this.platformId) && this.identity.isAuthenticated()
      ? { size: String(PEOPLE_MATCHMAKING_PAGE_SIZE), ...this.cursor() }
      : undefined,
  );

  private readonly matchUsers = linkedSignal<
    {
      signedIn: boolean;
      cursor: { afterCreatedAt: string; afterId: string } | null;
      page: UserPageResponse | undefined;
    },
    readonly DiscoveredUserResponse[]
  >({
    source: () => ({
      signedIn: this.identity.isAuthenticated(),
      cursor: this.cursor(),
      page: this.matches.hasValue() ? this.matches.value() : undefined,
    }),
    computation: ({ signedIn, cursor, page }, previous) => {
      if (!signedIn) return [];
      if (!page) return cursor ? (previous?.value ?? []) : [];
      if (previous && page === previous.source.page) return previous.value;
      return cursor ? [...(previous?.value ?? []), ...page.content] : page.content;
    },
  });

  private readonly followOverrides = linkedSignal<boolean, ReadonlyMap<string, boolean>>({
    source: () => this.identity.isAuthenticated(),
    computation: () => new Map(),
  });
  private readonly blockedIds = linkedSignal<boolean, ReadonlySet<string>>({
    source: () => this.identity.isAuthenticated(),
    computation: () => new Set(),
  });
  private readonly pendingIds = signal<ReadonlySet<string>>(new Set());

  private readonly queryState = linkedSignal<string>(() => this.queryParamMap?.().get('q') ?? '');
  readonly query: Signal<string> = this.queryState.asReadonly();
  private readonly normalizedQuery = computed(() => this.query().trim());
  readonly searching: Signal<boolean> = computed(
    () => this.normalizedQuery().length >= PEOPLE_MIN_SEARCH_LENGTH,
  );

  private readonly debouncedQuery = debounced(
    () => (this.searching() ? this.normalizedQuery() : ''),
    PEOPLE_SEARCH_DEBOUNCE_MS,
  );
  private readonly settledQuery = computed(() =>
    this.debouncedQuery.hasValue() ? this.debouncedQuery.value() : '',
  );

  private readonly search = this.usersApi.searchResource(() => {
    const query = this.normalizedQuery();
    const settled = this.settledQuery();
    return isPlatformBrowser(this.platformId) &&
      this.identity.isAuthenticated() &&
      this.searching() &&
      query === settled
      ? settled
      : undefined;
  });

  readonly status: Signal<ResourceStatus> = computed((): ResourceStatus => {
    if (this.searching()) {
      return this.normalizedQuery() !== this.settledQuery() ? 'loading' : this.search.status();
    }
    return this.matches.status();
  });
  readonly loading: Signal<boolean> = computed(
    (): boolean => this.status() === 'loading' || this.status() === 'reloading',
  );
  readonly error: Signal<string | null> = computed((): string | null => {
    const err = this.searching() ? this.search.error() : this.matches.error();
    return err
      ? errorMessage(err, this.searching() ? 'Could not search users.' : 'Could not load people.')
      : null;
  });
  readonly needsLearningLanguage: Signal<boolean> = computed((): boolean => {
    if (this.searching()) return false;
    const err = this.matches.error();
    return err instanceof ApiError && err.type === 'urn:jtalk:user:problem:no-learning-language';
  });
  readonly hasMore: Signal<boolean> = computed(
    (): boolean => !this.searching() && this.matches.hasValue() && this.matches.value().hasNext,
  );
  readonly busyIds: Signal<ReadonlySet<string>> = this.pendingIds.asReadonly();

  readonly people: Signal<readonly DiscoveredUserResponse[]> = computed(
    (): readonly DiscoveredUserResponse[] => {
      const overrides = this.followOverrides();
      const blocked = this.blockedIds();
      const directory = this.identity.userDirectory();
      const users = this.searching()
        ? this.normalizedQuery() === this.settledQuery() && this.search.hasValue()
          ? this.search.value()
          : []
        : this.matchUsers();

      return users
        .filter((u) => !blocked.has(u.id))
        .map((u) => {
          const synced = overlayUserSummary(u, directory);
          const override = overrides.get(u.id);
          return override === undefined || override === synced.followedByMe
            ? synced
            : { ...synced, followedByMe: override };
        });
    },
  );

  constructor() {
    effect(() => {
      if (this.matches.hasValue()) {
        const content = this.matches.value().content;
        untracked(() => this.identity.mergeUserSummaries(content));
      }
    });

    effect(() => {
      if (this.search.hasValue()) {
        const results = this.search.value();
        untracked(() => this.identity.mergeUserSummaries(results));
      }
    });
  }

  setQuery(raw: string): void {
    this.queryState.set(raw);
  }

  refresh(): void {
    this.followOverrides.set(new Map());
    if (this.searching()) this.search.reload();
    else if (this.cursor()) this.cursor.set(null);
    else this.matches.reload();
  }

  loadMore(): void {
    if (!this.hasMore() || this.matches.isLoading() || !this.matches.hasValue()) return;
    const { nextAfterCreatedAt, nextAfterId } = this.matches.value();
    if (nextAfterCreatedAt && nextAfterId) {
      this.cursor.set({ afterCreatedAt: nextAfterCreatedAt, afterId: nextAfterId });
    }
  }

  setFollowOverride(userId: string, followed: boolean): void {
    this.followOverrides.update((prev): ReadonlyMap<string, boolean> =>
      new Map(prev).set(userId, followed),
    );
  }

  markBlocked(userId: string): void {
    this.blockedIds.update((prev): ReadonlySet<string> => new Set(prev).add(userId));
    this.followOverrides.update((prev): ReadonlyMap<string, boolean> => {
      if (!prev.has(userId)) return prev;
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  }

  setPending(userId: string, busy: boolean): void {
    this.pendingIds.update((prev): ReadonlySet<string> => {
      const next = new Set(prev);
      if (busy) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }
}
