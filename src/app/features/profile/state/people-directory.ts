import { computed, inject, Service, signal } from '@angular/core';
import type { PersonSummary } from '@shared/utils/people';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, finalize, map, of, type Observable } from 'rxjs';
import { IdentityService } from '@core/auth/identity.service';
import { PeopleApiService } from '@core/people/people-api.service';
import { msg } from '@shared/utils/i18n/msg';
import { pagedList } from '@shared/utils/paged-list';
import { saveRequest } from '@shared/utils/save-request';
import type { PartnerCursor } from '@core/people/people.parser';

const SEARCH_DELAY_MS = 300;
const NOBODY = { items: [] as PersonSummary[], next: null };
/** Shorter than this finds nearly everyone, so it is not worth asking. */
export const MIN_SEARCH_LENGTH = 2;

/**
 * What the People page works from: partners to meet, a search, who you follow and who follows you, and who you have blocked, each
 * read when it is first looked at. Following someone from any of them is remembered here so the buttons agree wherever they are.
 */
@Service()
export class PeopleDirectory {
  private readonly api = inject(PeopleApiService);
  private readonly identity = inject(IdentityService);

  readonly partners = pagedList((after: PartnerCursor | null) => this.api.partners(after));
  readonly following = pagedList((page: number | null) => {
    const me = this.identity.userId();
    return me === null ? of(NOBODY) : this.api.following(me, page ?? 0);
  });
  readonly followers = pagedList((page: number | null) => {
    const me = this.identity.userId();
    return me === null ? of(NOBODY) : this.api.followers(me, page ?? 0);
  });
  readonly blocked = pagedList(() =>
    this.api.blocked().pipe(map((items) => ({ items, next: null }))),
  );

  /** What is typed in the search box; the search itself waits for a pause in typing. */
  readonly term = signal('');
  private readonly asked = toSignal(
    toObservable(this.term).pipe(
      debounceTime(SEARCH_DELAY_MS),
      map((typed) => typed.trim()),
    ),
    { initialValue: '' },
  );
  readonly searching = computed(() => this.asked().length >= MIN_SEARCH_LENGTH);
  private readonly found = rxResource({
    params: () => (this.searching() ? this.asked() : undefined),
    stream: ({ params }) => this.api.search(params),
  });
  readonly results = computed(() => (this.searching() ? (this.found.value() ?? []) : []));
  readonly searchLoading = computed(
    () =>
      this.term().trim().length >= MIN_SEARCH_LENGTH &&
      (this.found.isLoading() || this.term().trim() !== this.asked()),
  );
  readonly searchFailed = computed(() => this.searching() && this.found.error() !== undefined);

  /** Who you follow or do not, as changed here since the lists were read. */
  private readonly changed = signal<ReadonlyMap<string, boolean>>(new Map());
  private readonly working = signal<ReadonlySet<string>>(new Set());
  readonly action = saveRequest();

  /** Whether you follow them: what was done here if anything, else `known` (what the list they are in says). */
  isFollowing(id: string, known: boolean): boolean {
    return this.changed().get(id) ?? known;
  }

  isBusy(id: string): boolean {
    return this.working().has(id);
  }

  follow(id: string): void {
    this.change(id, true, this.api.follow(id), msg('Could not follow them. Please try again.'));
  }

  unfollow(id: string): void {
    this.change(
      id,
      false,
      this.api.unfollow(id),
      msg('Could not unfollow them. Please try again.'),
    );
  }

  /** Lets someone you blocked find you again, and takes them off the list. */
  unblock(id: string, done: () => void): void {
    this.working.update((now) => new Set(now).add(id));
    this.action.run(this.finished(id, this.api.unblock(id)), {
      next: () => {
        this.blocked.remove(id);
        done();
      },
      failure: msg('Could not unblock them. Please try again.'),
    });
  }

  /** Stops showing `id` as busy when the request ends, however it ends. */
  private finished(id: string, request: Observable<void>): Observable<void> {
    return request.pipe(finalize(() => this.working.update((now) => without(now, id))));
  }

  private change(id: string, following: boolean, request: Observable<void>, failure: string): void {
    this.working.update((now) => new Set(now).add(id));
    this.action.run(this.finished(id, request), {
      next: () => {
        this.changed.update((now) => new Map(now).set(id, following));
      },
      failure,
    });
  }
}

function without(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const rest = new Set(set);
  rest.delete(id);
  return rest;
}
