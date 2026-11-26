export const LANGUAGE_FILTER_CHIPS = [
  { value: 'all', label: 'All languages' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'ar', label: 'Arabic' },
  { value: 'ja', label: 'Japanese' },
  { value: 'de', label: 'German' },
] as const;

export type RoomLangFilter = (typeof LANGUAGE_FILTER_CHIPS)[number]['value'];

export interface LanguageFilterChip {
  readonly value: RoomLangFilter;
  readonly label: string;
}

export function parseRoomLangFilter(raw: string | null): RoomLangFilter {
  if (!raw) return 'all';
  const normalized = raw.trim().toLowerCase();
  const match = LANGUAGE_FILTER_CHIPS.find((chip) => chip.value === normalized);
  return match ? match.value : 'all';
}

export const ROOM_CARD_AVATAR_LIMIT = 3;

export const ROOM_DOT_BY_LANG: Readonly<Record<string, string>> = {
  en: 'dot-brand-blue',
  es: 'dot-positive',
  fr: 'dot-nb-error',
  ar: 'dot-positive',
  ja: 'dot-positive',
  de: 'dot-brand-blue',
};

export const ROOMS_SSE_IDLE_TIMEOUT_MS = 45_000;
export const ROOMS_SSE_FIRST_EVENT_TIMEOUT_MS = 25_000;
export const ROOMS_LIST_PAGE_SIZE = 100;
export const ROOMS_POLL_INTERVAL_MS = 15_000;
export const ROOMS_RECONNECT_POLL_DELAY_MS = 60_000;
export const ROOMS_RECONNECT_BASE_DELAY_MS = 1_500;
export const ROOMS_POLL_AFTER_ATTEMPTS = 3;
export const HERO_CYCLE_INTERVAL_MS = 18_000;
