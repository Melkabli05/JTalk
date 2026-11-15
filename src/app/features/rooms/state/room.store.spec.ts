import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RoomStore } from './room.store';

const BASE = '/api/v1/voice-rooms/r-1';
const ROOM = {
  id: 'r-1',
  title: 'Spanish',
  topic: '',
  hostId: 'h-1',
  targetLanguage: 'es',
  nativeLanguage: 'en',
  maxStageSeats: 4,
  createdAt: '2026-11-14T10:00:00Z',
  speakers: ['h-1'],
  participantCount: 3,
  handRaiseCount: 1,
};

describe('RoomStore', () => {
  let http: HttpTestingController;

  function setup(me = 'm-1') {
    localStorage.clear();
    localStorage.setItem(
      'jtalk:profile',
      JSON.stringify({ id: me, name: 'Me', nativeLanguage: 'ar', learning: 'es', avatar: '' }),
    );
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(RoomStore);
  }

  async function load(
    store: RoomStore,
    server: { stage?: object; people?: object[] } = {},
  ): Promise<void> {
    TestBed.tick();
    for (const request of http.match(() => true)) {
      const url = request.request.url;
      request.flush(
        url === BASE
          ? ROOM
          : url.endsWith('/stage')
            ? (server.stage ?? { speakers: ['h-1'], handRaiseQueue: [] })
            : (server.people ?? []),
      );
    }
    await Promise.resolve();
    TestBed.tick();
    void store;
  }

  it('asks the server for nothing until a room is shown', () => {
    setup();
    TestBed.tick();

    http.expectNone(() => true);
  });

  it('fetches the room, the stage and who is present once a room is shown', () => {
    const store = setup();

    store.show('r-1');
    TestBed.tick();

    http.expectOne(BASE);
    http.expectOne(`${BASE}/stage`);
    http.expectOne(`${BASE}/participants`);
    expect(store.roomId()).toBe('r-1');
  });

  it('knows who hosts, who speaks, who has a hand up, and what that makes this person', async () => {
    const store = setup('m-1');
    store.show('r-1');
    await load(store, { stage: { speakers: ['h-1', 'm-1'], handRaiseQueue: ['b-1'] } });

    expect(store.hostId()).toBe('h-1');
    expect(store.isHost()).toBe(false);
    expect(store.speakers()).toEqual(['h-1', 'm-1']);
    expect(store.queue()).toEqual(['b-1']);
    expect(store.onStage()).toBe(true);
    expect(store.handRaised()).toBe(false);
  });

  it('recognises the host, and a raised hand', async () => {
    const store = setup('h-1');
    store.show('r-1');
    await load(store, { stage: { speakers: ['h-1'], handRaiseQueue: ['h-1'] } });

    expect(store.isHost()).toBe(true);
    expect(store.handRaised()).toBe(true);
  });

  it('puts everyone present who is not on stage in the audience', async () => {
    const store = setup('m-1');
    store.show('r-1');
    await load(store, {
      stage: { speakers: ['h-1'], handRaiseQueue: [] },
      people: [
        { userId: 'h-1', role: 'HOST', status: 'ACTIVE' },
        { userId: 'b-1', role: 'LISTENER', status: 'ACTIVE' },
      ],
    });

    expect(store.audience()).toEqual(['b-1']);
  });

  it('counts this person in the audience as soon as they have joined, before the server lists them', async () => {
    const store = setup('m-1');
    store.show('r-1');
    await load(store);
    expect(store.audience()).toEqual([]);

    store.markJoined(true);
    expect(store.joined()).toBe(true);
    expect(store.audience()).toEqual(['m-1']);

    store.markJoined(false);
    expect(store.audience()).toEqual([]);
  });

  it('lists the speakers whose connection dropped', async () => {
    const store = setup();
    store.show('r-1');
    await load(store, {
      people: [
        { userId: 'h-1', role: 'HOST', status: 'RECONNECTING' },
        { userId: 'b-1', role: 'LISTENER', status: 'ACTIVE' },
      ],
    });

    expect(store.reconnecting()).toEqual(['h-1']);
  });

  it('forgets that the person had joined when another room is shown', () => {
    const store = setup();
    store.show('r-1');
    store.markJoined(true);

    store.show('r-2');

    expect(store.joined()).toBe(false);
    expect(store.roomId()).toBe('r-2');
  });

  it('fetches everything again on reload', async () => {
    const store = setup();
    store.show('r-1');
    await load(store);

    store.reload();
    TestBed.tick();

    http.expectOne(BASE);
    http.expectOne(`${BASE}/stage`);
    http.expectOne(`${BASE}/participants`);
  });
});
