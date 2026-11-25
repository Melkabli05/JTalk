import { asRecord, isStringList } from '../../../core/http/as-record';
import { VoiceRoomDto } from '../../../shared/models/voice-room.model';
import { RoomFeedEvent, RoomLiveStats } from '../models/room-feed.model';

function isRoomLiveStats(raw: unknown): raw is RoomLiveStats {
  const stats = asRecord(raw);
  return stats !== undefined && isStringList(stats['speakers']) &&
    typeof stats['participantCount'] === 'number' && typeof stats['handRaiseCount'] === 'number';
}

function isVoiceRoom(raw: unknown): raw is VoiceRoomDto {
  const room = asRecord(raw);
  return room !== undefined &&
    typeof room['id'] === 'string' &&
    typeof room['title'] === 'string' &&
    (room['topic'] == null || typeof room['topic'] === 'string') &&
    typeof room['hostId'] === 'string' &&
    typeof room['targetLanguage'] === 'string' &&
    typeof room['nativeLanguage'] === 'string' &&
    typeof room['maxStageSeats'] === 'number' &&
    (room['createdAt'] === undefined || typeof room['createdAt'] === 'string') &&
    isRoomLiveStats(room);
}

function isVoiceRoomList(raw: unknown): raw is readonly VoiceRoomDto[] {
  return Array.isArray(raw) && raw.every(isVoiceRoom);
}

export function parseRoomList(raw: unknown) {
  const content = asRecord(raw)?.['content'];
  if (!isVoiceRoomList(content)) throw new Error('Unexpected response: expected live room list.');
  return content;
}

function isRoomFeedEvent(raw: unknown): raw is RoomFeedEvent {
  const event = asRecord(raw);
  switch (event?.['type']) {
    case 'SNAPSHOT':
      return isVoiceRoomList(event['rooms']);
    case 'ROOM_OPENED':
    case 'ROOM_UPDATED':
      return isVoiceRoom(event['room']);
    case 'ROOM_CLOSED':
      return typeof event['roomId'] === 'string';
    case 'ROOM_STATS':
      return typeof event['roomId'] === 'string' && isRoomLiveStats(event['live']);
    default:
      return false;
  }
}

export function decodeRoomFeedMessage(data: unknown): RoomFeedEvent | undefined {
  if (typeof data !== 'string') return undefined;
  try {
    const event: unknown = JSON.parse(data);
    return isRoomFeedEvent(event) ? event : undefined;
  } catch {
    return undefined;
  }
}
