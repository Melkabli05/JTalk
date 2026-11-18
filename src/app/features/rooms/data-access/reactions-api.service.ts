import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/http/api-base-url.token';
import type { Reaction } from '../models/reaction.model';

@Service()
export class ReactionsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/v1/voice-rooms`;

  react(id: string, reaction: Reaction): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/reactions`, { reaction });
  }
}
