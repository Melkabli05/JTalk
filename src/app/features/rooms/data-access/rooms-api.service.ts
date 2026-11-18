import { HttpClient, httpResource, HttpResourceRef } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { concatMap, map, type Observable } from 'rxjs';
import { API_BASE_URL } from '@core/http/api-base-url.token';
import { serverSentJson } from '@shared/utils/server-sent-events';
import type { RoomFeedEvent } from '../models/room-feed.model';
import type { Room, RoomDraft, RoomEdit, RoomSession } from '../models/room.model';
import { parseRoomFeedEvent } from './parsers/room-feed.parser';
import { parseRoom, parseRooms, parseSession } from './parsers/room.parser';

const PAGE_SIZE = 100;

@Service()
export class RoomsApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/v1/voice-rooms`;

  /** The open rooms, once. After this, {@link feed} says what changes. */
  rooms(): Observable<Room[]> {
    return this.http.get<unknown>(`${this.url}?size=${PAGE_SIZE}`).pipe(map(parseRooms));
  }

  /**
   * What happens to the open rooms, as it happens: a `READY` first, then rooms opened, changed and closed and their numbers. It stays
   * open until unsubscribed; it completes or errors when the connection drops.
   */
  feed(): Observable<RoomFeedEvent> {
    return serverSentJson(this.http, `${this.url}/feed`).pipe(
      concatMap((raw) => {
        const event = parseRoomFeedEvent(raw);
        return event === undefined ? [] : [event];
      }),
    );
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
