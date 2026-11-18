import type { Room } from './room.model';

/** What the server tells the hallway about the open rooms: the list first, then what changes. */
export type RoomFeedEvent =
  | { readonly type: 'SNAPSHOT'; readonly rooms: readonly Room[] }
  | { readonly type: 'ROOM_OPENED' | 'ROOM_UPDATED'; readonly room: Room }
  | { readonly type: 'ROOM_CLOSED'; readonly roomId: string }
  | {
      readonly type: 'ROOM_STATS';
      readonly roomId: string;
      readonly speakers: readonly string[];
      readonly participantCount: number;
      readonly handRaiseCount: number;
    };
