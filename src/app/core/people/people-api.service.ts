import { HttpClient, httpResource, HttpResourceRef, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { API_BASE_URL } from '@core/http/api-base-url.token';
import type { Page } from '@shared/utils/paged-list';
import type { SocialStats, PersonSummary } from '@shared/utils/people';
import type { PersonDetails } from './person-card.model';
import {
  parseDetails,
  parseFollowPage,
  parsePartnerPage,
  parseSocial,
  parseSummaries,
  type PartnerCursor,
} from './people.parser';

@Service()
export class PeopleApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/v1/users`;

  detailsResource(id: () => string | null): HttpResourceRef<PersonDetails | undefined> {
    return httpResource(() => (id() ? `${this.url}/${id()}` : undefined), { parse: parseDetails });
  }

  socialResource(id: () => string | null): HttpResourceRef<SocialStats | undefined> {
    return httpResource(() => (id() ? `${this.url}/${id()}/social` : undefined), {
      parse: parseSocial,
    });
  }

  follow(id: string): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/follow`, null);
  }

  unfollow(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}/follow`);
  }

  block(id: string): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/block`, null);
  }

  unblock(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}/block`);
  }

  /** People whose name or handle matches, best first. */
  search(query: string): Observable<PersonSummary[]> {
    return this.http
      .get<unknown>(`${this.url}/search`, { params: new HttpParams().set('q', query) })
      .pipe(map(parseSummaries));
  }

  /** Language-exchange partners for the person signed in: native in what they learn, learning what they speak. */
  partners(after: PartnerCursor | null): Observable<Page<PersonSummary, PartnerCursor>> {
    const params =
      after === null
        ? new HttpParams()
        : new HttpParams().set('afterCreatedAt', after.createdAt).set('afterId', after.id);
    return this.http
      .get<unknown>(`${this.url}/matchmaking`, { params })
      .pipe(map(parsePartnerPage));
  }

  followers(id: string, page: number): Observable<Page<PersonSummary, number>> {
    return this.http
      .get<unknown>(`${this.url}/${id}/followers`, { params: new HttpParams().set('page', page) })
      .pipe(map(parseFollowPage));
  }

  following(id: string, page: number): Observable<Page<PersonSummary, number>> {
    return this.http
      .get<unknown>(`${this.url}/${id}/following`, { params: new HttpParams().set('page', page) })
      .pipe(map(parseFollowPage));
  }

  blocked(): Observable<PersonSummary[]> {
    return this.http.get<unknown>(`${this.url}/me/blocks`).pipe(map(parseSummaries));
  }
}
