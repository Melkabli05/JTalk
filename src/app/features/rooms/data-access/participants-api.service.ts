import { HttpClient, httpResource, HttpResourceRef } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { API_BASE_URL } from '@core/http/api-base-url.token';
import type { Participant, RoomSession } from '../models/room.model';
import { parseSession } from './adapters/rooms.adapter';
import { parseParticipants } from './adapters/stage.adapter';

/** The only code that knows the participants endpoints and their wire format. */
@Service()
export class ParticipantsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/v1/voice-rooms`;

  /** Who is in the room right now. Call it from an injection context. */
  participantsResource(id: () => string): HttpResourceRef<Participant[] | undefined> {
    return httpResource(() => (id() ? `${this.base}/${id()}/participants` : undefined), {
      parse: parseParticipants,
    });
  }

  join(id: string): Observable<RoomSession> {
    return this.http
      .post<unknown>(`${this.base}/${id}/participants/join`, null)
      .pipe(map(parseSession));
  }

  leave(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/participants/leave`, null);
  }

  /** Says "still here". The backend answers 403 once the host has removed this person. */
  heartbeat(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/participants/heartbeat`, null);
  }

  /** Host only: removes the person and bars them from coming back. */
  remove(id: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/participants/${userId}`);
  }
}
