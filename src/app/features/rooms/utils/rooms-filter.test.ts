import { LiveRoomCard } from '../models/room-card.model';
import {
  filterRoomsByLanguage,
  orderPinnedRooms,
  toLiveRoomCard,
} from './rooms-filter';

const SAMPLE_ROOMS: readonly LiveRoomCard[] = [
  {
    id: 'en-1',
    hostAvatar: null,
    lang: 'en',
    langLabel: 'English · B1–B2',
    dotClass: 'dot-brand-blue',
    title: 'Evening conversation club',
    description: 'Small talk and weekend plans.',
    avatars: [],
    moreCount: '+5',
    meta: '8 speaking · 14 listening',
  },
  {
    id: 'fr-1',
    hostAvatar: null,
    lang: 'fr',
    langLabel: 'French · A2–B1',
    dotClass: 'dot-nb-error',
    title: 'Café français du soir',
    description: 'On parle de tout.',
    avatars: [],
    moreCount: '+2',
    meta: '5 speaking · 9 listening',
  },
  {
    id: 'ja-1',
    hostAvatar: null,
    lang: 'ja',
    langLabel: 'Japanese · N5–N4',
    dotClass: 'dot-positive',
    title: "Beginners' speaking practice",
    description: 'Short sentences.',
    avatars: [],
    moreCount: '+7',
    meta: '10 speaking · 21 listening',
  },
];

describe('rooms-filter', () => {
  it('returns all rooms when filter is all', () => {
    const result = filterRoomsByLanguage(SAMPLE_ROOMS, 'all');
    expect(result.length).toBe(3);
  });

  it('filters rooms by specific language code', () => {
    const french = filterRoomsByLanguage(SAMPLE_ROOMS, 'fr');
    expect(french.length).toBe(1);
    expect(french[0].id).toBe('fr-1');

    const japanese = filterRoomsByLanguage(SAMPLE_ROOMS, 'ja');
    expect(japanese.length).toBe(1);
    expect(japanese[0].id).toBe('ja-1');
  });

  it('orders multiple pinned rooms in priority order in a single pass', () => {
    const ordered = orderPinnedRooms(SAMPLE_ROOMS, ['ja-1', 'missing', 'fr-1', 'ja-1']);
    expect(ordered.map((r) => r.id)).toEqual(['ja-1', 'fr-1', 'en-1']);
  });

  it('maps a VoiceRoomDto into a LiveRoomCard with speaker initials and overflow count', () => {
    const card = toLiveRoomCard(
      {
        id: 'room-1',
        hostId: 'u-1',
        title: 'Tokyo Night Chat',
        topic: '',
        targetLanguage: 'ja',
        nativeLanguage: 'en',
        maxStageSeats: 6,
        participantCount: 5,
        handRaiseCount: 0,
        speakers: ['u-1', 'u-2'],
      },
      new Map([['u-1', { displayName: 'Amina' }]]),
    );

    expect(card.lang).toBe('ja');
    expect(card.hostAvatar?.initial).toBe('A');
    expect(card.hostAvatar?.displayName).toBe('Amina');
    expect(card.avatars.map((a) => a.initial)).toEqual(['S']);
    expect(card.moreCount).toBe('+3');
    expect(card.meta).toBe('2 speaking · 5 participants · 6 seats');
  });
});
