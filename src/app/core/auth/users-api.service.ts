import { HttpClient, httpResource, HttpResourceRef } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { API_BASE_URL } from '@core/http/api-base-url.token';
import type { Person } from './identity.models';
import { parseLearningLanguages, parsePeople, parsePerson } from './users.parser';

export interface NewProfile {
  readonly username: string;
  readonly displayName: string;
  readonly avatarUrl: string;
  readonly nativeLanguage: string;
  readonly bio?: string;
  readonly countryCode?: string;
}

export type ProfileChange = Omit<NewProfile, 'username'>;

/** The user service: who people are (name, picture, languages). The access token is added by the Auth0 interceptor. */
@Service()
export class UsersApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/v1/users`;

  /** The caller's profile; a 404 means they have not created one yet. */
  meResource(enabled: () => boolean): HttpResourceRef<Person | undefined> {
    return httpResource(() => (enabled() ? `${this.url}/me` : undefined), { parse: parsePerson });
  }

  learningResource(enabled: () => boolean): HttpResourceRef<string[] | undefined> {
    return httpResource(() => (enabled() ? `${this.url}/me/languages` : undefined), {
      parse: parseLearningLanguages,
    });
  }

  create(profile: NewProfile): Observable<Person> {
    return this.http.post<unknown>(`${this.url}/me`, profile).pipe(map(parsePerson));
  }

  update(change: ProfileChange): Observable<Person> {
    return this.http.patch<unknown>(`${this.url}/me`, change).pipe(map(parsePerson));
  }

  addLearning(languageCode: string): Observable<void> {
    return this.http
      .post<unknown>(`${this.url}/me/languages`, { languageCode, languageType: 'LEARNING' })
      .pipe(map(() => undefined));
  }

  removeLanguage(languageCode: string): Observable<void> {
    return this.http
      .delete<unknown>(`${this.url}/me/languages/${languageCode}`)
      .pipe(map(() => undefined));
  }

  /** Names and pictures for many people in one call: a whole room. */
  people(ids: readonly string[]): Observable<Person[]> {
    return this.http.post<unknown>(`${this.url}/batch`, { ids }).pipe(map(parsePeople));
  }
}
