import { HttpClient, httpResource, HttpResourceRef } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/http/api-base-url.token';
import type { LanguageMatrix, SocialStats } from '@shared/utils/people';
import type { PersonDetails } from './person-card.model';
import { parseDetails, parseLanguages, parseSocial } from './people.parser';

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

  languagesResource(id: () => string | null): HttpResourceRef<LanguageMatrix | undefined> {
    return httpResource(() => (id() ? `${this.url}/${id()}/languages` : undefined), {
      parse: parseLanguages,
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
}
