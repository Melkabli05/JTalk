import { asRecord, isStringList } from '@shared/utils/as-record';
import type { Room, RoomSession } from '../../models/room.model';

function readRoom(raw: unknown): Room | undefined {
  const room = asRecord(raw);
  if (room === undefined) {
    return undefined;
  }
  const topic = room['topic'] ?? '';
  if (
    typeof room['id'] !== 'string' ||
    typeof room['title'] !== 'string' ||
    typeof topic !== 'string' ||
    typeof room['hostId'] !== 'string' ||
    typeof room['targetLanguage'] !== 'string' ||
    typeof room['nativeLanguage'] !== 'string' ||
    typeof room['maxStageSeats'] !== 'number' ||
    !isStringList(room['speakers']) ||
    typeof room['participantCount'] !== 'number' ||
    typeof room['handRaiseCount'] !== 'number'
  ) {
    return undefined;
  }
  return {
    id: room['id'],
    title: room['title'],
    topic,
    hostId: room['hostId'],
    targetLanguage: room['targetLanguage'],
    nativeLanguage: room['nativeLanguage'],
    maxStageSeats: room['maxStageSeats'],
    speakers: room['speakers'],
    participantCount: room['participantCount'],
    handRaiseCount: room['handRaiseCount'],
  };
}

export function parseRoom(raw: unknown): Room {
  const room = readRoom(raw);
  if (room === undefined) {
    throw new Error('Unexpected response: expected a room');
  }
  return room;
}

export function parseRooms(raw: unknown): Room[] {
  const content = asRecord(raw)?.['content'];
  if (!Array.isArray(content)) {
    throw new Error('Unexpected response: expected a page of rooms');
  }
  return content.map((item) => parseRoom(item));
}

export function parseSession(raw: unknown): RoomSession {
  const session = asRecord(raw);
  const room = readRoom(session?.['room']);
  if (
    session === undefined ||
    room === undefined ||
    typeof session['canPublishAudio'] !== 'boolean' ||
    typeof session['liveKitUrl'] !== 'string' ||
    typeof session['liveKitToken'] !== 'string'
  ) {
    throw new Error('Unexpected response: expected a room session');
  }
  return {
    room,
    canPublishAudio: session['canPublishAudio'],
    liveKitUrl: session['liveKitUrl'],
    liveKitToken: session['liveKitToken'],
  };
}
