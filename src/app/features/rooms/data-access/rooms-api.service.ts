import { HttpClient, httpResource, HttpResourceRef } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { API_BASE_URL } from '@core/http/api-base-url.token';
import type { Room, RoomDraft, RoomEdit, RoomSession } from '../models/room.model';
import { parseRoom, parseRooms, parseSession } from './parsers/room.parser';

const PAGE_SIZE = 100;

@Service()
export class RoomsApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/v1/voice-rooms`;

  roomsResource(): HttpResourceRef<Room[] | undefined> {
    return httpResource(() => `${this.url}?size=${PAGE_SIZE}`, { parse: parseRooms });
  }

  roomResource(id: () => string): HttpResourceRef<Room | undefined> {
    return httpResource(() => (id() ? `${this.url}/${id()}` : undefined), { parse: parseRoom });
  }

  create(draft: RoomDraft): Observable<RoomSession> {
    return this.http.post<unknown>(this.url, draft).pipe(map(parseSession));
  }

  update(id: string, edit: RoomEdit): Observable<Room> {
    return this.http.patch<unknown>(`${this.url}/${id}`, edit).pipe(map(parseRoom));
  }

  close(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
