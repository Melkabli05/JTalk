import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { fakeIdentity } from '@core/auth/auth-testing';
import { failUntilGivenUp, openFeed } from '../data-access/room-feed-testing';
import type { Room } from '../models/room.model';
import { changed, RoomListStore } from './room-list.store';

const room = (id: string, targetLanguage = 'es') => ({
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

describe('changed (what happens to the list)', () => {
  const ids = (rooms: readonly Room[] | undefined) => rooms?.map((r) => r.id);

  it('starts from the list the server sends', () => {
    expect(ids(changed(undefined, { type: 'SNAPSHOT', rooms: [room('a'), room('b')] }))).toEqual([
      'a',
      'b',
    ]);
  });

  it('replaces the list when the server sends it again', () => {
    expect(ids(changed([room('a')], { type: 'SNAPSHOT', rooms: [room('z')] }))).toEqual(['z']);
  });

  it('has nothing to change before the list has arrived', () => {
    expect(changed(undefined, { type: 'ROOM_OPENED', room: room('a') })).toBeUndefined();
  });

  it('puts a room that opens first, as the newest', () => {
    expect(ids(changed([room('a')], { type: 'ROOM_OPENED', room: room('b') }))).toEqual(['b', 'a']);
  });

  it('does not show a room twice when the list already had the one that opened', () => {
    const rooms = changed([room('b'), room('a')], {
      type: 'ROOM_OPENED',
      room: { ...room('b'), title: 'fresher' },
    });

    expect(rooms?.map((r) => r.title)).toEqual(['fresher', 'a']);
  });

  it('changes a room that was edited, in place', () => {
    const rooms = changed([room('a'), room('b')], {
      type: 'ROOM_UPDATED',
      room: { ...room('a'), title: 'New title' },
    });

    expect(rooms?.map((r) => r.title)).toEqual(['New title', 'b']);
  });

  it('drops a room that closes', () => {
    expect(ids(changed([room('a'), room('b')], { type: 'ROOM_CLOSED', roomId: 'a' }))).toEqual([
      'b',
    ]);
  });

  it('moves the numbers on a card, and only on that card', () => {
    const [a, b] =
      changed([room('a'), room('b')], {
        type: 'ROOM_STATS',
        roomId: 'b',
        speakers: ['h-1', 's-1'],
        participantCount: 9,
        handRaiseCount: 2,
      }) ?? [];

    expect(a.participantCount).toBe(1);
    expect(b).toMatchObject({ speakers: ['h-1', 's-1'], participantCount: 9, handRaiseCount: 2 });
  });
});

describe('RoomListStore', () => {
  afterEach(() => vi.useRealTimers());

  function setup(resolve: (ids: Iterable<string>) => void = () => undefined) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        fakeIdentity(
          { id: 'm-1', name: 'Me', nativeLanguage: 'ar', learning: 'es', avatar: '' },
          resolve,
        ).provider,
      ],
    });
    const store = TestBed.inject(RoomListStore);
    TestBed.tick();
    return { store, http: TestBed.inject(HttpTestingController) };
  }

  async function listed(rooms: object[], resolve?: (ids: Iterable<string>) => void) {
    const harness = setup(resolve);
    const feed = openFeed(harness.http);
    feed.say({ type: 'SNAPSHOT', rooms });
    await settle();
    return { ...harness, feed };
  }
  const ids = (store: RoomListStore) => store.shown().map((r) => r.id);
  /** Lets the resource publish what it was just told. */
  const settle = async () => {
    await TestBed.inject(ApplicationRef).whenStable();
    TestBed.tick();
  };
  /** The same while the stream is still trying to connect, which keeps the app from ever being stable. */
  const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
    TestBed.tick();
  };

  it('lists nothing until the server has sent the list', () => {
    const { store } = setup();

    expect(store.rooms()).toBeUndefined();
    expect(store.shown()).toEqual([]);
    expect(store.languages()).toEqual([]);
  });

  it('looks the hosts and speakers on the cards up in the user service, once rooms are listed', async () => {
    const resolve = vi.fn();
    const withSpeakers = { ...room('r-2', 'fr'), hostId: 'h-2', speakers: ['h-2', 's-1'] };

    await listed([room('r-1'), withSpeakers], resolve);

    expect(new Set(resolve.mock.lastCall?.[0] as string[])).toEqual(new Set(['h-1', 'h-2', 's-1']));
  });

  it('shows every open room, and the languages they practise once each', async () => {
    const { store } = await listed([room('a'), room('b', 'fr'), room('c')]);

    expect(ids(store)).toEqual(['a', 'b', 'c']);
    expect(store.languages()).toEqual(['es', 'fr']);
  });

  it('narrows the list to one language, and back', async () => {
    const { store } = await listed([room('a'), room('b', 'fr'), room('c')]);

    store.filter.set('es');
    expect(ids(store)).toEqual(['a', 'c']);

    store.filter.set('');
    expect(store.shown()).toHaveLength(3);
  });

  it('follows rooms opening and closing, and the numbers on their cards, with no further request', async () => {
    const { store, http, feed } = await listed([room('a')]);

    feed.say({ type: 'ROOM_OPENED', room: room('b', 'fr') });
    await settle();
    expect(ids(store)).toEqual(['b', 'a']);
    expect(store.languages()).toEqual(['fr', 'es']);

    feed.say({
      type: 'ROOM_STATS',
      roomId: 'a',
      live: { speakers: ['h-1'], participantCount: 7, handRaiseCount: 0 },
    });
    await settle();
    expect(store.shown().find((r) => r.id === 'a')?.participantCount).toBe(7);

    feed.say({ type: 'ROOM_CLOSED', roomId: 'b' });
    await settle();
    expect(ids(store)).toEqual(['a']);
    expect(store.languages()).toEqual(['es']);
    http.verify();
  });

  it('is not failed while it is still trying, and fails when the server cannot be reached', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { store, http } = setup();

    openFeed(http).fail();
    await flush();
    expect(store.failed()).toBe(false);

    vi.advanceTimersByTime(1000);
    openFeed(http).fail();
    vi.advanceTimersByTime(2000);
    openFeed(http).fail();
    vi.advanceTimersByTime(4000);
    openFeed(http).fail();
    vi.advanceTimersByTime(8000);
    openFeed(http).fail();
    vi.advanceTimersByTime(16_000);
    openFeed(http).fail();
    await flush();

    expect(store.failed()).toBe(true);
  });

  it('connects again on reload, after giving up', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { store, http } = setup();
    failUntilGivenUp(http);
    await flush();
    expect(store.failed()).toBe(true);

    store.reload();
    await flush();
    openFeed(http).say({ type: 'SNAPSHOT', rooms: [room('a')] });
    await flush();

    expect(store.failed()).toBe(false);
    expect(ids(store)).toEqual(['a']);
  });
});
