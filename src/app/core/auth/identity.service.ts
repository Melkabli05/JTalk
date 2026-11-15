import { HttpClient } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { catchError, map, type Observable, of, switchMap, tap } from 'rxjs';
import { asRecord } from '@shared/utils/as-record';
import { readItem, writeItem } from '@shared/utils/safe-storage';
import { environment } from '../../../environments/environment';
import { STORAGE_KEYS } from '../config/app-config';
import { AuthService } from './auth.service';
import { DEV_IDENTITY } from './dev-identity.token';
import type { Person, ProfileDraft } from './identity.models';
import { tokenSubject } from './token-subject';

/** A person as stored or as the backend lists them; the picture is optional, since older profiles have none. */
function toPerson(raw: unknown): Person | null {
  const person = asRecord(raw);
  if (
    person === undefined ||
    typeof person['id'] !== 'string' ||
    typeof person['name'] !== 'string' ||
    typeof person['nativeLanguage'] !== 'string' ||
    typeof person['learning'] !== 'string'
  ) {
    return null;
  }
  return {
    id: person['id'],
    name: person['name'],
    nativeLanguage: person['nativeLanguage'],
    learning: person['learning'],
    avatar: typeof person['avatar'] === 'string' ? person['avatar'] : '',
  };
}

function isPerson(person: Person | null): person is Person {
  return person !== null;
}

function storedProfile(): Person | null {
  try {
    return toPerson(JSON.parse(readItem('local', STORAGE_KEYS.profile) ?? 'null'));
  } catch {
    return null;
  }
}

/**
 * Who the user is. With a token it is the token's subject. Without one (only in a development build, against the
 * backend's `dev` profile, which has no sign-in and no user store) it is the profile the person fills in before using
 * the app, kept in this browser; a real user service replaces that later. `directory` is how screens turn ids into
 * names: it holds this profile and everyone else who registered theirs with the backend.
 */
@Service()
export class IdentityService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  readonly devMode = inject(DEV_IDENTITY);

  private readonly own = signal<Person | null>(storedProfile());
  private readonly others = signal<readonly Person[]>([]);

  readonly profile = this.own.asReadonly();
  readonly directory = computed(() => {
    const people = new Map(this.others().map((person) => [person.id, person]));
    const me = this.own();
    return me ? people.set(me.id, me) : people;
  });
  readonly devUserId = computed(() => (this.devMode ? (this.own()?.id ?? null) : null));
  readonly userId = computed(() => tokenSubject(this.auth.token()) ?? this.devUserId());

  /** True until the person has filled in a profile (development builds only). */
  readonly needsProfile = computed(
    () => this.devMode && !this.auth.isAuthenticated() && this.own() === null,
  );

  /**
   * Registers this profile with the backend again (it forgets on restart) and reads everyone's. Safe to call often;
   * outside a development build, and on any failure, it does nothing.
   */
  load(): Observable<void> {
    if (!this.devMode) {
      return of(undefined);
    }
    const me = this.own();
    const register = me
      ? this.http
          .post<void>(`${environment.devUrl}/users`, me)
          .pipe(catchError(() => of(undefined)))
      : of(undefined);
    return register.pipe(
      switchMap(() => this.http.get<unknown>(`${environment.devUrl}/users`)),
      map((raw) => (Array.isArray(raw) ? raw.map(toPerson).filter(isPerson) : [])),
      tap((people) => this.others.set(people)),
      map(() => undefined),
      catchError(() => of(undefined)),
    );
  }

  /** Keeps the profile in this browser (the id is made once and kept) and tells the backend. */
  saveProfile(draft: ProfileDraft): void {
    const profile: Person = {
      id: this.own()?.id ?? crypto.randomUUID(),
      name: draft.name.trim(),
      nativeLanguage: draft.nativeLanguage,
      learning: draft.learning,
      avatar: draft.avatar,
    };
    this.own.set(profile);
    writeItem('local', STORAGE_KEYS.profile, JSON.stringify(profile));
    this.load().subscribe();
  }
}
