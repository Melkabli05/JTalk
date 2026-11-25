import { HttpClient, HttpContext, httpResource } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { SseClient } from 'ngx-sse-client';
import { filter, lastValueFrom, map } from 'rxjs';
import { ROOM_FEED_TRANSPORT, RoomFeedTransportHooks } from './room-feed-transport';
import { API_BASE_URL } from '../../../core/http/api-base-url.token';
import {
  CreateVoiceRoomPayload,
  RoomSessionDto,
  UpdateVoiceRoomPayload,
  VoiceRoomDto,
} from '../../../shared/models/voice-room.model';
import { decodeRoomFeedMessage, parseRoomList } from './room-feed';
import { ROOMS_LIST_PAGE_SIZE } from '../constants/rooms.constants';

@Service()
export class RoomsApi {
  private readonly sse = inject(SseClient);
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/v1/voice-rooms`;

  listRoomsResource(enabled: () => boolean) {
    return httpResource(
      () => enabled() ? {
        url: this.base,
        params: { size: ROOMS_LIST_PAGE_SIZE },
        transferCache: false,
      } : undefined,
      { parse: parseRoomList },
    );
  }

  roomFeed(hooks: RoomFeedTransportHooks) {
    return this.sse.stream(`${this.base}/feed`, { keepAlive: false }, {
      headers: { Accept: 'text/event-stream' },
      context: new HttpContext().set(ROOM_FEED_TRANSPORT, hooks),
    }).pipe(
      filter((event): event is MessageEvent<unknown> => event.type === 'message'),
      map(event => decodeRoomFeedMessage(event.data)),
      filter(event => event !== undefined),
    );
  }

  createRoom(payload: CreateVoiceRoomPayload): Promise<RoomSessionDto> {
    return lastValueFrom(this.http.post<RoomSessionDto>(this.base, payload));
  }

  updateRoom(roomId: string, payload: UpdateVoiceRoomPayload): Promise<VoiceRoomDto> {
    return lastValueFrom(this.http.patch<VoiceRoomDto>(this.roomUrl(roomId), payload));
  }

  closeRoom(roomId: string): Promise<void> {
    return lastValueFrom(this.http.delete<void>(this.roomUrl(roomId)));
  }

  private roomUrl(roomId: string): string {
    return `${this.base}/${encodeURIComponent(roomId)}`;
  }
}
