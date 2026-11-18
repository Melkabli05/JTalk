import { TestBed } from '@angular/core/testing';
import { fakeIdentity } from '@core/auth/auth-testing';
import type { Room } from '../models/room.model';
import { RoomListStore } from './room-list.store';

const room = (id: string, targetLanguage = 'es'): Room => ({
  id,
  title: id,
  topic: '',
  hostId: 'h-1',
  targetLanguage,
  nativeLanguage: 'en',
  maxStageSeats: 4,
  speakers: ['h-1'],
  participantCount: 1,
  handRaiseCount: 0,
});

describe('RoomListStore', () => {
  function setup(resolve: (ids: Iterable<string>) => void = () => undefined) {
    TestBed.configureTestingModule({
      providers: [
        fakeIdentity(
          { id: 'm-1', name: 'Me', nativeLanguage: 'ar', learning: 'es', avatar: '' },
          resolve,
        ).provider,
      ],
    });
    return TestBed.inject(RoomListStore);
  }

  function listed(rooms: Room[], resolve?: (ids: Iterable<string>) => void) {
    const store = setup(resolve);
    store.apply({ type: 'LISTED', rooms });
    TestBed.tick();
    return store;
  }
  const ids = (store: RoomListStore) => store.shown().map((r) => r.id);

  it('looks the hosts and speakers on the cards up in the user service, once rooms are listed', () => {
    const resolve = vi.fn();
    const withSpeakers = { ...room('r-2', 'fr'), hostId: 'h-2', speakers: ['h-2', 's-1'] };

    listed([room('r-1'), withSpeakers], resolve);

    expect(new Set(resolve.mock.lastCall?.[0] as string[])).toEqual(new Set(['h-1', 'h-2', 's-1']));
  });

  it('lists nothing until the list has been loaded', () => {
    const store = setup();

    expect(store.rooms()).toBeUndefined();
    expect(store.shown()).toEqual([]);
    expect(store.languages()).toEqual([]);
  });

  it('ignores changes that arrive before the list: the list will already have them', () => {
    const store = setup();

    store.apply({ type: 'ROOM_OPENED', room: room('a') });

    expect(store.rooms()).toBeUndefined();
  });

  it('shows every open room, and the languages they practise once each', () => {
    const store = listed([room('a'), room('b', 'fr'), room('c')]);

    expect(ids(store)).toEqual(['a', 'b', 'c']);
    expect(store.languages()).toEqual(['es', 'fr']);
  });

  it('narrows the list to one language, and back', () => {
    const store = listed([room('a'), room('b', 'fr'), room('c')]);

    store.filter.set('es');
    expect(ids(store)).toEqual(['a', 'c']);

    store.filter.set('');
    expect(store.shown()).toHaveLength(3);
  });

  it('puts a room that opens first, as the newest', () => {
    const store = listed([room('a')]);

    store.apply({ type: 'ROOM_OPENED', room: room('b') });

    expect(ids(store)).toEqual(['b', 'a']);
  });

  it('does not show a room twice when the list already had the one that opened', () => {
    const store = listed([room('b'), room('a')]);

    store.apply({ type: 'ROOM_OPENED', room: { ...room('b'), title: 'fresher' } });

    expect(store.shown().map((r) => r.title)).toEqual(['fresher', 'a']);
  });

  it('changes a room that was edited, in place', () => {
    const store = listed([room('a'), room('b')]);

    store.apply({ type: 'ROOM_UPDATED', room: { ...room('a'), title: 'New title' } });

    expect(store.shown().map((r) => r.title)).toEqual(['New title', 'b']);
  });

  it('drops a room that closes, and the language nobody practises any more', () => {
    const store = listed([room('a'), room('b', 'fr')]);

    store.apply({ type: 'ROOM_CLOSED', roomId: 'b' });

    expect(ids(store)).toEqual(['a']);
    expect(store.languages()).toEqual(['es']);
  });

  it('moves the numbers on a card, and only on that card', () => {
    const store = listed([room('a'), room('b')]);

    store.apply({
      type: 'ROOM_STATS',
      roomId: 'b',
      speakers: ['h-1', 's-1'],
      participantCount: 9,
      handRaiseCount: 2,
    });

    const [a, b] = store.shown();
    expect(a.participantCount).toBe(1);
    expect(b).toMatchObject({ speakers: ['h-1', 's-1'], participantCount: 9, handRaiseCount: 2 });
  });

  it('loading the list again replaces it, and clears a failure', () => {
    const store = listed([room('a')]);
    store.failed.set(true);

    store.apply({ type: 'LISTED', rooms: [room('z')] });

    expect(ids(store)).toEqual(['z']);
    expect(store.failed()).toBe(false);
  });
});
