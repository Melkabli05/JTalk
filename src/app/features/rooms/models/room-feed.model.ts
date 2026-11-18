import type { Room } from './room.model';

/** What the server tells the hallway about the open rooms, after the list has been loaded once. */
export type RoomFeedEvent =
  /** The stream is connected and nothing earlier will be missed: load the list now. */
  | { readonly type: 'READY' }
  | { readonly type: 'ROOM_OPENED' | 'ROOM_UPDATED'; readonly room: Room }
  | { readonly type: 'ROOM_CLOSED'; readonly roomId: string }
  | {
      readonly type: 'ROOM_STATS';
      readonly roomId: string;
      readonly speakers: readonly string[];
      readonly participantCount: number;
      readonly handRaiseCount: number;
    };

/** A change to the hallway's list: the list as loaded, or something the server said happened since. */
export type RoomListChange =
  | { readonly type: 'LISTED'; readonly rooms: readonly Room[] }
  | Exclude<RoomFeedEvent, { readonly type: 'READY' }>;
