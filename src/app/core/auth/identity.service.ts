import { ActiveRoomService } from '../rooms/active-room.service';
import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '@auth0/auth0-angular';
import {
  catchError,
  defer,
  EMPTY,
  firstValueFrom,
  from,
  type Observable,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { avatarPath } from '@shared/utils/avatars';
import { httpStatus } from '@shared/utils/http-status';
import { loadedValue } from '@shared/utils/resource-value';
import type { Person, ProfileDraft } from './identity.models';
import { UsersApiService } from './users-api.service';

/** The user service takes at most this many ids in one lookup. */
const MAX_LOOKUP = 500;

function extras(draft: ProfileDraft, clearable: boolean): { bio?: string; countryCode?: string } {
  const bio = draft.bio?.trim();
  return {
    ...(bio === undefined || (bio === '' && !clearable) ? {} : { bio }),
    ...(draft.countryCode ? { countryCode: draft.countryCode } : {}),
  };
}

/** A handle people never see, made from the name and a random tail so two people called Mona do not collide. */
function usernameFor(name: string): string {
  const base = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);
  return `${base || 'user'}_${crypto.randomUUID().replaceAll('-', '').slice(0, 6)}`;
}

/**
 * Who is signed in and who everyone else is. Signing in is Auth0's (the SDK holds the session and the interceptor adds the access token);
 * the profile lives in the user service. A person who has signed in but has no profile yet gets {@link needsProfile}, which asks for one.
 */
@Service()
export class IdentityService {
  private readonly auth = inject(AuthService);
  private readonly activeRoom = inject(ActiveRoomService);
  private readonly api = inject(UsersApiService);

  readonly signedIn = toSignal(this.auth.isAuthenticated$, { initialValue: false });

  private readonly meResource = this.api.meResource(this.signedIn);
  private readonly mine = loadedValue(this.meResource);

  private readonly others = signal<ReadonlyMap<string, Person>>(new Map());
  private readonly asked = new Set<string>();

  readonly profile = computed<Person | null>(() => this.mine() ?? null);
  readonly userId = computed(() => this.mine()?.id ?? null);
  readonly needsProfile = computed(
    () => this.signedIn() && httpStatus(this.meResource.error()) === 404,
  );
  /** Everyone whose name and picture are known: the person signed in, and whoever {@link resolve} has looked up. */
  readonly directory = computed<ReadonlyMap<string, Person>>(() => {
    const known = new Map(this.others());
    const me = this.profile();
    if (me) {
      known.set(me.id, me);
    }
    return known;
  });

  /** Looks up people not seen yet, in one call, so the rooms can show names and pictures instead of ids. */
  resolve(ids: Iterable<string>): void {
    const me = this.userId();
    const missing = [...new Set(ids)].filter((id) => id !== '' && id !== me && !this.asked.has(id));
    for (let start = 0; start < missing.length; start += MAX_LOOKUP) {
      const batch = missing.slice(start, start + MAX_LOOKUP);
      batch.forEach((id) => this.asked.add(id));
      this.api.people(batch).subscribe({
        next: (people) => {
          this.others.update(
            (known) => new Map([...known, ...people.map((p) => [p.id, p] as const)]),
          );
        },
        error: () => {
          batch.forEach((id) => this.asked.delete(id)); // a failed lookup is tried again the next time they are on screen
        },
      });
    }
  }

  /**
   * Creates the profile on the first save, and changes it after that: one request either way, the languages included, so a save either
   * happens whole or not at all. The answer is the saved profile, which becomes the one shown (no second round trip to read it back).
   */
  saveProfile(draft: ProfileDraft): Observable<Person> {
    const current = this.mine();
    return (
      current === undefined ? this.createProfile(draft) : this.changeProfile(draft, current)
    ).pipe(tap((saved) => this.meResource.set(saved)));
  }

  /**
   * Deletes the person's account for good, then signs them out. Their room is left first. The sign-in itself (Auth0) is not deleted, so
   * they can sign up again with a fresh profile.
   */
  deleteAccount(): Observable<void> {
    this.activeRoom.leave();
    return this.api.deleteMe().pipe(
      // Once the account is gone the person must not be left in the app, with a profile that no longer exists: if Auth0's sign-out fails,
      // they are sent to the start, where signing in begins afresh.
      switchMap(() =>
        from(this.signOut()).pipe(
          catchError(() => {
            window.location.assign('/');
            return EMPTY;
          }),
        ),
      ),
    );
  }

  /** Sends the person to Auth0 to sign in, or to create an account: they come back to this app, signed in. */
  signIn(mode: 'login' | 'signup' = 'login'): Observable<void> {
    return this.auth.loginWithRedirect(
      mode === 'signup' ? { authorizationParams: { screen_hint: 'signup' } } : undefined,
    );
  }

  async signOut(): Promise<void> {
    this.activeRoom.leave();
    await firstValueFrom(this.auth.logout({ logoutParams: { returnTo: window.location.origin } }));
  }

  private createProfile(draft: ProfileDraft): Observable<Person> {
    const create = () =>
      this.api.create({
        username: usernameFor(draft.name),
        displayName: draft.name.trim(),
        avatarUrl: avatarPath(draft.avatar),
        nativeLanguage: draft.nativeLanguage,
        learningLanguages: [{ languageCode: draft.learning }],
        ...extras(draft, false),
      });
    return defer(create).pipe(
      // The random tail collided with someone else's handle: try once with another.
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === 409
          ? defer(create)
          : throwError(() => error),
      ),
    );
  }

  private changeProfile(draft: ProfileDraft, current: Person): Observable<Person> {
    return this.api.update({
      displayName: draft.name.trim(),
      avatarUrl: avatarPath(draft.avatar),
      nativeLanguage: draft.nativeLanguage,
      // Only when the language being learned changed: sending it replaces the whole list, and so would drop the levels and any other
      // language a person has listed.
      ...(draft.learning === current.learning
        ? {}
        : { learningLanguages: [{ languageCode: draft.learning }] }),
      ...extras(draft, true),
    });
  }
}
