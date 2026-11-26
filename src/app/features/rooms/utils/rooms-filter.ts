import {
  languageLabelFor,
  languageNameFor,
  roomFilterKeyFor,
} from '../../../core/utils/language-codes';
import { sanitizeAvatarUrl } from '../../../core/utils/safe-url';
import { VoiceRoomDto } from '../../../shared/models/voice-room.model';
import { avatarChipClassFor } from '../../../shared/utils/avatar-chip.utils';
import { ROOM_CARD_AVATAR_LIMIT, ROOM_DOT_BY_LANG } from '../constants/rooms.constants';
import { LiveRoomCard, RoomAvatarItem, RoomLangFilter } from '../models/room-card.model';

export function filterRoomsByLanguage(
  rooms: readonly LiveRoomCard[],
  filter: RoomLangFilter,
): readonly LiveRoomCard[] {
  return filter === 'all' ? rooms : rooms.filter((room) => room.lang === filter);
}

export function orderPinnedRooms(
  rooms: readonly LiveRoomCard[],
  pinnedIds: readonly string[],
): readonly LiveRoomCard[] {
  if (pinnedIds.length === 0 || rooms.length <= 1) return rooms;
  const byId = new Map(rooms.map((room) => [room.id, room]));
  const pinned: LiveRoomCard[] = [];
  for (const id of pinnedIds) {
    const match = byId.get(id);
    if (match) {
      pinned.push(match);
      byId.delete(id);
    }
  }
  return pinned.length === 0 ? rooms : [...pinned, ...byId.values()];
}

function buildRoomAvatar(
  userId: string,
  directory: ReadonlyMap<string, { displayName: string; avatarUrl?: string | null }>,
  fallbackName: string,
): RoomAvatarItem {
  const entry = directory.get(userId);
  const displayName = entry?.displayName?.trim() || fallbackName;
  return {
    userId,
    displayName,
    initial: (displayName[0] ?? 'J').toUpperCase(),
    avatarUrl: sanitizeAvatarUrl(entry?.avatarUrl) ?? null,
    chipClass: avatarChipClassFor(userId),
  };
}

export function toLiveRoomCard(
  room: VoiceRoomDto,
  directory: ReadonlyMap<string, { displayName: string; avatarUrl?: string | null }>,
): LiveRoomCard {
  const chipKey = roomFilterKeyFor(room.targetLanguage);
  const lang: LiveRoomCard['lang'] = chipKey === 'all' ? 'other' : chipKey;
  const visibleOthers = room.speakers
    .filter((id) => id !== room.hostId)
    .slice(0, ROOM_CARD_AVATAR_LIMIT);
  const avatars = visibleOthers.map((userId) => buildRoomAvatar(userId, directory, 'Speaker'));
  const hostAvatar = room.hostId ? buildRoomAvatar(room.hostId, directory, 'Host') : null;

  const speakerCount = room.speakers.length;
  const hostOnStage = Boolean(room.hostId && room.speakers.includes(room.hostId));
  const shownCount = visibleOthers.length + (hostOnStage ? 1 : 0);
  const overflow = Math.max(0, room.participantCount - shownCount);

  return {
    id: room.id,
    hostAvatar,
    lang,
    langLabel: languageLabelFor(room.targetLanguage),
    dotClass: ROOM_DOT_BY_LANG[lang] ?? 'dot-brand-blue',
    title: room.title,
    description:
      room.topic ||
      `Practising ${languageNameFor(room.targetLanguage)} · ${languageNameFor(room.nativeLanguage)} speakers welcome`,
    avatars,
    moreCount: overflow > 0 ? `+${overflow}` : '',
    meta: `${speakerCount} speaking · ${room.participantCount} participant${room.participantCount === 1 ? '' : 's'} · ${room.maxStageSeats} seats`,
  };
}
