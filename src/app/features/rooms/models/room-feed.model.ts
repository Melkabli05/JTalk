import { VoiceRoomDto } from '../../../shared/models/voice-room.model';

export type RoomLiveStats = Pick<VoiceRoomDto, 'speakers' | 'participantCount' | 'handRaiseCount'>;

export type RoomFeedEvent =
  | { readonly type: 'SNAPSHOT'; readonly rooms: readonly VoiceRoomDto[] }
  | { readonly type: 'ROOM_OPENED' | 'ROOM_UPDATED'; readonly room: VoiceRoomDto }
  | { readonly type: 'ROOM_CLOSED'; readonly roomId: string }
  | { readonly type: 'ROOM_STATS'; readonly roomId: string; readonly live: RoomLiveStats };
