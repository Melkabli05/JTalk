import { HttpClient, httpResource, HttpResourceRef } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/http/api-base-url.token';
import type { Stage } from '../models/room.model';
import { parseStage } from './adapters/stage.adapter';

/** The only code that knows the stage endpoints and their wire format. */
@Service()
export class StageApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/v1/voice-rooms`;

  /** The speakers and the hand-raise queue. Call it from an injection context. */
  stageResource(id: () => string): HttpResourceRef<Stage | undefined> {
    return httpResource(() => (id() ? `${this.base}/${id()}/stage` : undefined), {
      parse: parseStage,
    });
  }

  takeSeat(id: string): Observable<void> {
    return this.post(id, 'join');
  }

  leaveSeat(id: string): Observable<void> {
    return this.post(id, 'leave');
  }

  raiseHand(id: string): Observable<void> {
    return this.post(id, 'raise-hand');
  }

  lowerHand(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/stage/raise-hand`);
  }

  /** Host only: seats a listener. */
  promote(id: string, userId: string): Observable<void> {
    return this.post(id, `promote/${userId}`);
  }

  /** Host only: moves a speaker back to the audience. */
  demote(id: string, userId: string): Observable<void> {
    return this.post(id, `demote/${userId}`);
  }

  private post(id: string, action: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/stage/${action}`, null);
  }
}
