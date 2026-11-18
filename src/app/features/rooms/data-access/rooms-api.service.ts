import { HttpClient, httpResource, HttpResourceRef } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { concatMap, map, type Observable, repeat, retry, timer } from 'rxjs';
import { API_BASE_URL } from '@core/http/api-base-url.token';
import { serverSentJson } from '@shared/utils/server-sent-events';
import type { RoomFeedEvent } from '../models/room-feed.model';
import type { Room, RoomDraft, RoomEdit, RoomSession } from '../models/room.model';
import { parseRoomFeedEvent } from './parsers/room-feed.parser';
import { parseRoom, parseSession } from './parsers/room.parser';

const RECONNECT_MS = 1000;
const RETRIES = 5;

@Service()
export class RoomsApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/v1/voice-rooms`;

  /**
   * The open rooms and everything that happens to them: the list first, then rooms opened, changed and closed and their numbers. A
   * connection that ends is reopened (and starts from a fresh list); one that fails is retried with a growing pause, then gives up.
   */
  feed(): Observable<RoomFeedEvent> {
    return serverSentJson(this.http, `${this.url}/feed`).pipe(
      concatMap((raw) => {
        const event = parseRoomFeedEvent(raw);
        return event === undefined ? [] : [event];
      }),
      retry({
        count: RETRIES,
        delay: (_error, attempt) => timer(RECONNECT_MS * 2 ** (attempt - 1)),
        resetOnSuccess: true,
      }),
      repeat({ delay: RECONNECT_MS }),
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
