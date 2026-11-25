import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  debounced,
  effect,
  inject,
  Injectable,
  linkedSignal,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { DiscoveredUserResponse, UserPageResponse } from '../../../core/auth/auth.models';
import { IdentityStore } from '../../../core/auth/identity';
import { UsersApi } from '../../../core/auth/users-api';
import { errorMessage } from '../../../core/http/http-error.interceptor';
import { languageNameFor } from '../../../core/utils/language-codes';
import { sanitizeAvatarUrl } from '../../../core/utils/safe-url';
import { avatarChipClassFor } from '../../../shared/utils/avatar-chip.utils';
import {
  PEOPLE_MATCHMAKING_PAGE_SIZE,
  PEOPLE_MIN_SEARCH_LENGTH,
  PEOPLE_SEARCH_DEBOUNCE_MS,
} from '../constants/people.constants';
import { PractisingPerson } from '../models/person.model';

export interface FollowToggleResult {
  readonly ok: boolean;
  readonly followed: boolean;
  readonly error?: string;
}

export interface BlockUserResult {
  readonly ok: boolean;
  readonly error?: string;
}

@Injectable()
export class PeopleStore {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly usersApi = inject(UsersApi);
  private readonly identity = inject(IdentityStore);

  private readonly cursor = linkedSignal<boolean, { afterCreatedAt: string; afterId: string } | null>({
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

  readonly query = signal('');
  private readonly normalizedQuery = computed(() => this.query().trim());
  readonly searching = computed(() => this.normalizedQuery().length >= PEOPLE_MIN_SEARCH_LENGTH);

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

  readonly loading = computed(() =>
    this.searching()
      ? this.normalizedQuery() !== this.settledQuery() || this.search.isLoading()
      : this.matches.isLoading(),
  );
  readonly error = computed(() => {
    const err = this.searching() ? this.search.error() : this.matches.error();
    return err
      ? errorMessage(err, this.searching() ? 'Could not search users.' : 'Could not load people.')
      : null;
  });
  readonly hasMore = computed(
    () => !this.searching() && this.matches.hasValue() && this.matches.value().hasNext,
  );
  readonly busyIds = this.pendingIds.asReadonly();

  readonly people = computed<readonly PractisingPerson[]>(() => {
    const overrides = this.followOverrides();
    const blocked = this.blockedIds();
    const users = this.searching()
      ? this.normalizedQuery() === this.settledQuery() && this.search.hasValue()
        ? this.search.value()
        : []
      : this.matchUsers();

    return users
      .filter((u) => !blocked.has(u.id))
      .map((u) => ({
        id: u.id,
        name: u.displayName,
        username: u.username,
        initial: (u.displayName.trim()[0] ?? u.username[0] ?? 'U').toUpperCase(),
        chipClass: avatarChipClassFor(u.id),
        languages: `Speaks ${languageNameFor(u.nativeLanguage)}`,
        avatarUrl: sanitizeAvatarUrl(u.avatarUrl),
        followedByMe: overrides.get(u.id) ?? u.followedByMe,
      }));
  });

  constructor() {
    effect(() => {
      if (this.matches.hasValue()) {
        const content = this.matches.value().content;
        untracked(() => this.identity.mergeUserSummaries(content));
      }
    });
  }

  refresh(): void {
    this.followOverrides.set(new Map());
    if (this.searching()) this.search.reload();
    else if (this.cursor()) this.cursor.set(null);
    else this.matches.reload();
  }

  loadMore(): void {
    if (!this.hasMore() || !this.matches.hasValue()) return;
    const { nextAfterCreatedAt, nextAfterId } = this.matches.value();
    if (nextAfterCreatedAt && nextAfterId) {
      this.cursor.set({ afterCreatedAt: nextAfterCreatedAt, afterId: nextAfterId });
    }
  }

  async toggleFollow(person: PractisingPerson): Promise<FollowToggleResult> {
    if (this.pendingIds().has(person.id)) {
      return { ok: false, followed: person.followedByMe };
    }
    this.togglePending(person.id, true);
    const followed = !person.followedByMe;
    try {
      await (followed ? this.usersApi.follow(person.id) : this.usersApi.unfollow(person.id));
      this.followOverrides.update((prev) => new Map(prev).set(person.id, followed));
      this.identity.refreshSocialStats();
      return { ok: true, followed };
    } catch (err) {
      return {
        ok: false,
        followed: person.followedByMe,
        error: errorMessage(err, 'Could not update follow status.'),
      };
    } finally {
      this.togglePending(person.id, false);
    }
  }

  async blockUser(person: PractisingPerson): Promise<BlockUserResult> {
    if (this.pendingIds().has(person.id)) return { ok: false };
    this.togglePending(person.id, true);
    try {
      await this.usersApi.block(person.id);
      this.blockedIds.update((prev) => new Set(prev).add(person.id));
      this.followOverrides.update((prev) => {
        const next = new Map(prev);
        next.delete(person.id);
        return next;
      });
      this.identity.refreshSocialStats();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err, 'Could not block user.') };
    } finally {
      this.togglePending(person.id, false);
    }
  }

  private togglePending(id: string, busy: boolean): void {
    this.pendingIds.update((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
