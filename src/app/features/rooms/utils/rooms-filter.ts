import {
  languageLabelFor,
  languageNameFor,
  roomFilterKeyFor,
} from '../../../core/utils/language-codes';
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

export function toLiveRoomCard(
  room: VoiceRoomDto,
  directory: ReadonlyMap<string, { displayName: string; avatarUrl?: string | null }>,
): LiveRoomCard {
  const chipKey = roomFilterKeyFor(room.targetLanguage);
  const lang: LiveRoomCard['lang'] = chipKey === 'all' ? 'other' : chipKey;

  // Separate host from other speakers; show non-host first, host last (right-side visual slot)
  const otherSpeakers = room.speakers.filter((id) => id !== room.hostId);
  const hostIsOnStage = room.speakers.includes(room.hostId);

  // Visible cap: reserve one slot for host if on stage
  const nonHostLimit = hostIsOnStage
    ? Math.max(0, ROOM_CARD_AVATAR_LIMIT - 1)
    : ROOM_CARD_AVATAR_LIMIT;
  const visibleOthers = otherSpeakers.slice(0, nonHostLimit);
  const visibleSpeakers = hostIsOnStage
    ? [...visibleOthers, room.hostId]
    : visibleOthers;

  const toAvatar = (userId: string): RoomAvatarItem => {
    const entry = directory.get(userId);
    const name = entry?.displayName?.trim() || 'J';
    return {
      userId,
      displayName: entry?.displayName ?? '',
      initial: name[0]!.toUpperCase(),
      avatarUrl: entry?.avatarUrl ?? null,
      chipClass: avatarChipClassFor(userId),
      isHost: userId === room.hostId,
    };
  };

  const avatars = visibleSpeakers.map(toAvatar);
  const speakerCount = room.speakers.length;
  const overflow = Math.max(0, room.participantCount - visibleSpeakers.length);

  return {
    id: room.id,
    hostId: room.hostId,
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
