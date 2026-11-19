import type { Room } from '../models/room.model';
import { type Learner, suggest } from './suggestions';

const room = (id: string, over: Partial<Room> = {}): Room => ({
  id,
  title: id,
  topic: '',
  hostId: 'h',
  targetLanguage: 'es',
  nativeLanguage: 'en',
  maxStageSeats: 4,
  speakers: ['h'],
  participantCount: 1,
  handRaiseCount: 0,
  ...over,
});

const ME: Learner = { nativeLanguage: 'en', learning: 'es' };
const kinds = (rooms: readonly Room[], me: Learner | null = ME) =>
  suggest(rooms, me).map((s) => [s.kind, 'room' in s ? s.room.id : s.language]);

describe('suggest', () => {
  it('says to start one, in the language the person learns, when no room is open', () => {
    expect(kinds([])).toEqual([['start', 'es']]);
  });

  it('says to start one when no open room practises what they learn', () => {
    expect(kinds([room('fr', { targetLanguage: 'fr', participantCount: 5 })])).toEqual([
      ['busiest', 'fr'],
      ['start', 'es'],
    ]);
  });

  it('finds the room made for them: what they learn, for people who speak what they speak', () => {
    const rooms = [
      room('for-arabic', { nativeLanguage: 'ar', participantCount: 9 }),
      room('for-me', { participantCount: 2 }),
    ];

    expect(kinds(rooms)[0]).toEqual(['match', 'for-me']);
  });

  it('prefers the matching room with the most seats free, then the most people', () => {
    const rooms = [
      room('full', { maxStageSeats: 2, speakers: ['a', 'b'], participantCount: 20 }),
      room('seats', { maxStageSeats: 6, speakers: ['a'], participantCount: 3 }),
    ];

    expect(kinds(rooms)[0]).toEqual(['match', 'seats']);
  });

  it('suggests another room in their language with seats free to speak from, never the same room twice', () => {
    const rooms = [
      room('for-me', { participantCount: 4 }),
      room('other', { nativeLanguage: 'ar', maxStageSeats: 6, participantCount: 2 }),
      room('crowd', { targetLanguage: 'ja', participantCount: 30 }),
    ];

    expect(kinds(rooms)).toEqual([
      ['match', 'for-me'],
      ['seats', 'other'],
      ['busiest', 'crowd'],
    ]);
  });

  it('does not offer a seat in a room whose stage is full', () => {
    const rooms = [
      room('full', {
        nativeLanguage: 'ar',
        maxStageSeats: 1,
        speakers: ['h'],
        participantCount: 3,
      }),
    ];

    expect(kinds(rooms).map(([kind]) => kind)).toEqual(['busiest']);
  });

  it('offers only the busiest room while it is not yet known who the person is', () => {
    const rooms = [room('a', { participantCount: 2 }), room('b', { participantCount: 8 })];

    expect(kinds(rooms, null)).toEqual([['busiest', 'b']]);
  });

  it('does not tell someone with no language they learn to start one', () => {
    expect(kinds([], { nativeLanguage: 'en', learning: '' })).toEqual([]);
  });

  it('gives at most the number asked for', () => {
    const rooms = [
      room('for-me'),
      room('other', { nativeLanguage: 'ar', maxStageSeats: 6 }),
      room('crowd', { targetLanguage: 'ja', participantCount: 30 }),
    ];

    expect(suggest(rooms, ME, 2)).toHaveLength(2);
  });
});
