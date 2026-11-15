import { HttpClient, httpResource, HttpResourceRef } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { API_BASE_URL } from '@core/http/api-base-url.token';
import type { Room, RoomDraft, RoomEdit, RoomSession } from '../models/room.model';
import {
  parseRoom,
  parseRooms,
  parseSession,
  toCreatePayload,
  toUpdatePayload,
} from './adapters/rooms.adapter';

const PAGE_SIZE = 100;

/** The only code that knows the rooms endpoints and their wire format. */
@Service()
export class RoomsApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/v1/voice-rooms`;

  /** Open rooms, newest first. Call it from an injection context, e.g. a component field. */
  roomsResource(): HttpResourceRef<Room[] | undefined> {
    return httpResource(() => `${this.url}?size=${PAGE_SIZE}`, { parse: parseRooms });
  }

  /** One room, re-fetched whenever `id()` changes. Call it from an injection context. */
  roomResource(id: () => string): HttpResourceRef<Room | undefined> {
    return httpResource(() => `${this.url}/${id()}`, { parse: parseRoom });
  }

  /** Opens a room and joins it as host. A host with a room already open gets that room back. */
  create(draft: RoomDraft): Observable<RoomSession> {
    return this.http.post<unknown>(this.url, toCreatePayload(draft)).pipe(map(parseSession));
  }

  update(id: string, edit: RoomEdit): Observable<Room> {
    return this.http
      .patch<unknown>(`${this.url}/${id}`, toUpdatePayload(edit))
      .pipe(map(parseRoom));
  }

  close(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
