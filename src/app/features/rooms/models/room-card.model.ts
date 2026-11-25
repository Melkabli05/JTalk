import type { LANGUAGE_FILTER_CHIPS } from '../constants/rooms.constants';

export type RoomLangFilter = (typeof LANGUAGE_FILTER_CHIPS)[number]['value'];

export interface LanguageFilterChip {
  readonly value: RoomLangFilter;
  readonly label: string;
}

export interface RoomAvatarItem {
  readonly userId: string;
  readonly displayName: string;
  readonly initial: string;
  readonly avatarUrl: string | null;
  readonly chipClass: string;
  readonly isHost: boolean;
}

export interface LiveRoomCard {
  readonly id: string;
  readonly hostId: string;
  readonly lang: Exclude<RoomLangFilter, 'all'> | 'other';
  readonly langLabel: string;
  readonly dotClass: string;
  readonly title: string;
  readonly description: string;
  /** Non-host speakers shown first, host last (separated visually). */
  readonly avatars: readonly RoomAvatarItem[];
  readonly moreCount: string;
  readonly meta: string;
}
