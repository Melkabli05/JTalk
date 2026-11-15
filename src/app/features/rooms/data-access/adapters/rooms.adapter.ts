import { asRecord } from '@shared/utils/as-record';
import type { RoomSessionDto, VoiceRoomDto } from '../../models/room.dto';
import type { Room, RoomSession } from '../../models/room.model';

export function isStringList(raw: unknown): raw is readonly string[] {
  return Array.isArray(raw) && raw.every((item) => typeof item === 'string');
}

function isRoomDto(raw: unknown): raw is VoiceRoomDto {
  const dto = asRecord(raw);
  return (
    dto !== undefined &&
    typeof dto['id'] === 'string' &&
    typeof dto['title'] === 'string' &&
    (dto['topic'] === null || dto['topic'] === undefined || typeof dto['topic'] === 'string') &&
    typeof dto['hostId'] === 'string' &&
    typeof dto['targetLanguage'] === 'string' &&
    typeof dto['nativeLanguage'] === 'string' &&
    typeof dto['maxStageSeats'] === 'number' &&
    isStringList(dto['speakers']) &&
    typeof dto['participantCount'] === 'number' &&
    typeof dto['handRaiseCount'] === 'number'
  );
}

function isSessionDto(raw: unknown): raw is RoomSessionDto {
  const dto = asRecord(raw);
  return (
    dto !== undefined &&
    isRoomDto(dto['room']) &&
    typeof dto['canPublishAudio'] === 'boolean' &&
    typeof dto['liveKitUrl'] === 'string' &&
    typeof dto['liveKitToken'] === 'string'
  );
}

export function toRoom(dto: VoiceRoomDto): Room {
  return {
    id: dto.id,
    title: dto.title,
    topic: dto.topic ?? '',
    hostId: dto.hostId,
    targetLanguage: dto.targetLanguage,
    nativeLanguage: dto.nativeLanguage,
    maxStageSeats: dto.maxStageSeats,
    speakers: dto.speakers,
    participantCount: dto.participantCount,
    handRaiseCount: dto.handRaiseCount,
  };
}

/** `parse` for an `httpResource`: checks the response really is a room, then maps it. */
export function parseRoom(raw: unknown): Room {
  if (!isRoomDto(raw)) {
    throw new Error('Unexpected response: expected a room');
  }
  return toRoom(raw);
}

/** `parse` for an `httpResource`: checks the response really is a page of rooms, then maps them. */
export function parseRooms(raw: unknown): Room[] {
  const content = asRecord(raw)?.['content'];
  if (!Array.isArray(content)) {
    throw new Error('Unexpected response: expected a page of rooms');
  }
  return content.map((item) => parseRoom(item));
}

/** The result of opening or joining a room. */
export function parseSession(raw: unknown): RoomSession {
  if (!isSessionDto(raw)) {
    throw new Error('Unexpected response: expected a room session');
  }
  return {
    room: toRoom(raw.room),
    canPublishAudio: raw.canPublishAudio,
    liveKitUrl: raw.liveKitUrl,
    liveKitToken: raw.liveKitToken,
  };
}
