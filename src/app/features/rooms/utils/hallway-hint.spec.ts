import type { Room } from '../models/room.model';
import { hintFor } from './hallway-hint';

const room = (id: string, targetLanguage: string): Room => ({
  id,
  title: id,
  topic: '',
  hostId: 'h',
  targetLanguage,
  nativeLanguage: 'en',
  maxStageSeats: 4,
  speakers: ['h'],
  participantCount: 1,
  handRaiseCount: 0,
});

describe('hintFor', () => {
  it('counts the open rooms practising what the person learns', () => {
    const rooms = [room('a', 'es'), room('b', 'fr'), room('c', 'es')];

    expect(hintFor(rooms, { learning: 'es' })).toEqual({
      kind: 'practising',
      language: 'es',
      count: 2,
    });
  });

  it('says they could be the first when no open room practises it', () => {
    expect(hintFor([room('a', 'fr')], { learning: 'es' })).toEqual({
      kind: 'first',
      language: 'es',
    });
  });

  it('says they could be the first when no room is open at all', () => {
    expect(hintFor([], { learning: 'ja' })).toEqual({ kind: 'first', language: 'ja' });
  });

  it('has nothing to go by until the person, and a language they learn, are known', () => {
    expect(hintFor([room('a', 'es')], null)).toEqual({ kind: 'plain' });
    expect(hintFor([room('a', 'es')], { learning: '' })).toEqual({ kind: 'plain' });
  });
});
