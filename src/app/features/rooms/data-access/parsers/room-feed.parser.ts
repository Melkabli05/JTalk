import { asRecord, isStringList } from '@shared/utils/as-record';
import type { RoomFeedEvent } from '../../models/room-feed.model';
import { readRoom } from './room.parser';

/** A message of the room feed, or undefined for one this app does not know (a newer server may send more kinds). */
export function parseRoomFeedEvent(raw: unknown): RoomFeedEvent | undefined {
  const event = asRecord(raw);
  switch (event?.['type']) {
    case 'SNAPSHOT': {
      const rooms = Array.isArray(event['rooms']) ? event['rooms'].map(readRoom) : undefined;
      return rooms?.every((room) => room !== undefined) ? { type: 'SNAPSHOT', rooms } : undefined;
    }
    case 'ROOM_OPENED':
    case 'ROOM_UPDATED': {
      const room = readRoom(event['room']);
      return room === undefined ? undefined : { type: event['type'], room };
    }
    case 'ROOM_CLOSED': {
      const roomId = event['roomId'];
      return typeof roomId === 'string' ? { type: 'ROOM_CLOSED', roomId } : undefined;
    }
    case 'ROOM_STATS': {
      const roomId = event['roomId'];
      const live = asRecord(event['live']);
      return typeof roomId === 'string' &&
        isStringList(live?.['speakers']) &&
        typeof live['participantCount'] === 'number' &&
        typeof live['handRaiseCount'] === 'number'
        ? {
            type: 'ROOM_STATS',
            roomId,
            speakers: live['speakers'],
            participantCount: live['participantCount'],
            handRaiseCount: live['handRaiseCount'],
          }
        : undefined;
    }
    default:
      return undefined;
  }
}
