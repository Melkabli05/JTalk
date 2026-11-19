import { HttpClient, httpResource, HttpResourceRef } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { API_BASE_URL } from '@core/http/api-base-url.token';
import type { Person } from './identity.models';
import { parsePeople, parsePerson } from './users.parser';

interface LearningLanguage {
  readonly languageCode: string;
}

export interface NewProfile {
  readonly username: string;
  readonly displayName: string;
  readonly avatarUrl: string;
  readonly nativeLanguage: string;
  readonly bio?: string;
  readonly countryCode?: string;
  /** Saved with the profile, in the same request. */
  readonly learningLanguages: readonly LearningLanguage[];
}

/** A partial change: `learningLanguages` replaces the whole list when it is present, and leaves it alone when it is not. */
export type ProfileChange = Partial<NewProfile> &
  Pick<NewProfile, 'displayName' | 'avatarUrl' | 'nativeLanguage'>;

/** The user service: who people are (name, picture, languages). The access token is added by the Auth0 interceptor. */
@Service()
export class UsersApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/v1/users`;

  /** The caller's profile, with the languages they speak and learn; a 404 means they have not created one yet. */
  meResource(enabled: () => boolean): HttpResourceRef<Person | undefined> {
    return httpResource(() => (enabled() ? `${this.url}/me` : undefined), { parse: parsePerson });
  }

  create(profile: NewProfile): Observable<Person> {
    return this.http.post<unknown>(`${this.url}/me`, profile).pipe(map(parsePerson));
  }

  update(change: ProfileChange): Observable<Person> {
    return this.http.patch<unknown>(`${this.url}/me`, change).pipe(map(parsePerson));
  }

  /** Sets the caller's own picture, a small JPEG or PNG; the answer is the profile with its new address. */
  uploadAvatar(image: Blob): Observable<Person> {
    return this.http
      .put<unknown>(`${this.url}/me/avatar`, image, { headers: { 'Content-Type': image.type } })
      .pipe(map(parsePerson));
  }

  /** Deletes the caller's account: the profile, their languages, their follows and blocks. */
  deleteMe(): Observable<void> {
    return this.http.delete<void>(`${this.url}/me`);
  }

  /** Names and pictures for many people in one call: a whole room. */
  people(ids: readonly string[]): Observable<Person[]> {
    return this.http.post<unknown>(`${this.url}/batch`, { ids }).pipe(map(parsePeople));
  }
}
