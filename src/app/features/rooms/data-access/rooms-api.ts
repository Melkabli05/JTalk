import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { SseClient } from 'ngx-sse-client';
import { filter, map, type Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/http/api-base-url.token';
import type {
  CreateVoiceRoomPayload,
  RoomSessionDto,
  UpdateVoiceRoomPayload,
  VoiceRoomDto,
} from '../../../shared/models/voice-room.model';
import { ROOMS_LIST_PAGE_SIZE } from '../constants/rooms.constants';
import type { RoomFeedEvent } from '../models/room-feed.model';
import {
  ROOM_FEED_TRANSPORT,
  type RoomFeedTransportHooks,
} from '../../../core/http/room-feed-transport.token';

interface RoomListPage {
  readonly content: readonly VoiceRoomDto[];
}

function isObjectRecord(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function isRoomFeedEvent(value: unknown): value is RoomFeedEvent {
  if (!isObjectRecord(value)) return false;
  const type: unknown = Reflect.get(value, 'type');
  switch (type) {
    case 'SNAPSHOT':
      return Array.isArray(Reflect.get(value, 'rooms'));
    case 'ROOM_OPENED':
    case 'ROOM_UPDATED':
      return isObjectRecord(Reflect.get(value, 'room'));
    case 'ROOM_CLOSED':
      return typeof Reflect.get(value, 'roomId') === 'string';
    case 'ROOM_STATS':
      return (
        typeof Reflect.get(value, 'roomId') === 'string' &&
        isObjectRecord(Reflect.get(value, 'live'))
      );
    default:
      return false;
  }
}

function decodeRoomFeedMessage(data: unknown): RoomFeedEvent | undefined {
  if (typeof data !== 'string') return undefined;
  try {
    const parsed: unknown = JSON.parse(data);
    return isRoomFeedEvent(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

@Service()
export class RoomsApi {
  private readonly sse = inject(SseClient);
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/v1/voice-rooms`;

  listRooms(targetLanguage?: string): Observable<readonly VoiceRoomDto[]> {
    return this.http
      .get<RoomListPage>(this.base, {
        params: {
          size: ROOMS_LIST_PAGE_SIZE,
          expand: 'speakers',
          ...(targetLanguage ? { targetLanguage } : {}),
        },
        transferCache: false,
      })
      .pipe(
        map((page) => {
          if (!Array.isArray(page?.content)) {
            throw new Error('Unexpected response: expected live room list.');
          }
          return page.content;
        }),
      );
  }

  roomFeed(hooks: RoomFeedTransportHooks, targetLanguage?: string) {
    const url = targetLanguage
      ? `${this.base}/feed?targetLanguage=${encodeURIComponent(targetLanguage)}`
      : `${this.base}/feed`;
    return this.sse
      .stream(
        url,
        { keepAlive: false },
        {
          headers: { Accept: 'text/event-stream' },
          context: new HttpContext().set(ROOM_FEED_TRANSPORT, hooks),
        },
      )
      .pipe(
        filter((event): event is MessageEvent<unknown> => event.type === 'message'),
        map((event) => decodeRoomFeedMessage(event.data)),
        filter((event): event is RoomFeedEvent => event !== undefined),
      );
  }

  createRoom(payload: CreateVoiceRoomPayload): Observable<RoomSessionDto> {
    return this.http.post<RoomSessionDto>(this.base, payload);
  }

  updateRoom(roomId: string, payload: UpdateVoiceRoomPayload): Observable<VoiceRoomDto> {
    return this.http.patch<VoiceRoomDto>(this.roomUrl(roomId), payload);
  }

  closeRoom(roomId: string): Observable<void> {
    return this.http.delete<void>(this.roomUrl(roomId));
  }

  private roomUrl(roomId: string): string {
    return `${this.base}/${encodeURIComponent(roomId)}`;
  }
}
