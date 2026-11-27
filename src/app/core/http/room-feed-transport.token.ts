import { HttpContextToken } from '@angular/common/http';

export interface RoomFeedTransportHooks {
  activity(): void;
  disconnected(): void;
}

export const ROOM_FEED_TRANSPORT = new HttpContextToken<RoomFeedTransportHooks | null>(() => null);
