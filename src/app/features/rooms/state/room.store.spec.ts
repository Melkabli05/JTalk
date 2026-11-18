import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { fakeIdentity } from '@core/auth/auth-testing';
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

  function setup(me = 'm-1', resolve: (ids: Iterable<string>) => void = () => undefined) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        fakeIdentity(
          { id: me, name: 'Me', nativeLanguage: 'ar', learning: 'es', avatar: '' },
          resolve,
        ).provider,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(RoomStore);
  }

  async function load(
    store: RoomStore,
    server: { stage?: object; people?: object[] } = {},
  ): Promise<void> {
    store.sync();
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
  }

  it('looks everyone in the room up in the user service: the host, the stage, the raised hands and the audience', async () => {
    const resolve = vi.fn();
    const store = setup('m-1', resolve);

    store.show('r-1');
    await load(store, {
      stage: { speakers: ['h-1', 's-1'], handRaiseQueue: ['q-1'] },
      people: [{ userId: 'p-1', status: 'ACTIVE' }],
    });

    expect(new Set(resolve.mock.lastCall?.[0] as string[])).toEqual(
      new Set(['h-1', 's-1', 'q-1', 'p-1']),
    );
  });

  it('asks the server for nothing until a room is shown, and not even then until the link to its events is up', () => {
    const store = setup();
    TestBed.tick();
    http.expectNone(() => true);

    store.show('r-1');
    TestBed.tick();

    http.expectNone(() => true);
    expect(store.roomId()).toBe('r-1');
    expect(store.ready()).toBe(false);
  });

  it('reads the room, the stage and who is present once, when synced for the first time', async () => {
    const store = setup();
    store.show('r-1');

    store.sync();
    TestBed.tick();
    const room = http.expectOne(BASE);
    const stage = http.expectOne(`${BASE}/stage`);
    const people = http.expectOne(`${BASE}/participants`);
    expect(store.ready()).toBe(false);

    room.flush(ROOM);
    stage.flush({ speakers: ['h-1'], handRaiseQueue: [] });
    people.flush([]);
    await Promise.resolve();
    TestBed.tick();

    expect(store.ready()).toBe(true);
    http.verify();
  });

  describe('while the room is being read', () => {
    function reading() {
      const store = setup('m-1');
      store.show('r-1');
      store.sync();
      TestBed.tick();
      return {
        store,
        room: http.expectOne(BASE),
        stage: http.expectOne(`${BASE}/stage`),
        people: http.expectOne(`${BASE}/participants`),
      };
    }
    async function answered(read: ReturnType<typeof reading>, stage: object, people: object[]) {
      read.room.flush(ROOM);
      read.stage.flush(stage);
      read.people.flush(people);
      await Promise.resolve();
      TestBed.tick();
    }

    it('applies what arrived meanwhile again once the read is done, because the read may be older', async () => {
      const read = reading();

      read.store.apply({
        type: 'HAND_RAISED',
        at: 20,
        stage: { speakers: ['h-1'], handRaiseQueue: ['c-1'] },
      });
      read.store.apply({
        type: 'PRESENCE_CHANGED',
        participantCount: 4,
        joined: ['c-1'],
        left: ['b-1'],
      });
      await answered(read, { speakers: ['h-1'], handRaiseQueue: [] }, [
        { userId: 'b-1', status: 'ACTIVE' },
      ]);

      expect(read.store.queue()).toEqual(['c-1']);
      expect(read.store.audience()).toEqual(['c-1']);
      expect(read.store.room()?.participantCount).toBe(4);
    });

    it('does the same for a read after the first, and not for what came before it started', async () => {
      const read = reading();
      await answered(read, { speakers: ['h-1'], handRaiseQueue: [] }, []);
      read.store.apply({
        type: 'ROOM_UPDATED',
        title: 'Before the read',
        topic: '',
        maxStageSeats: 4,
      });

      read.store.sync();
      TestBed.tick();
      read.store.apply({
        type: 'ROOM_UPDATED',
        title: 'During the read',
        topic: '',
        maxStageSeats: 4,
      });
      http.expectOne(BASE).flush({ ...ROOM, title: 'From the server' });
      http.expectOne(`${BASE}/stage`).flush({ speakers: ['h-1'], handRaiseQueue: [] });
      http.expectOne(`${BASE}/participants`).flush([]);
      await Promise.resolve();
      TestBed.tick();

      // The read already has what came before it started; what came during it is applied on top.
      expect(read.store.room()?.title).toBe('During the read');
    });

    it('says the read failed, unless the room is simply gone', async () => {
      const failed = reading();
      failed.room.flush(ROOM);
      failed.stage.flush('no', { status: 500, statusText: 'Error' });
      failed.people.flush([]);
      await Promise.resolve();
      TestBed.tick();
      expect(failed.store.readFailed()).toBe(true);
      expect(failed.store.ready()).toBe(false);

      TestBed.resetTestingModule();
      const gone = reading();
      gone.room.flush('no', { status: 404, statusText: 'Not Found' });
      gone.stage.flush('no', { status: 404, statusText: 'Not Found' });
      gone.people.flush('no', { status: 404, statusText: 'Not Found' });
      await Promise.resolve();
      TestBed.tick();
      expect(gone.store.readFailed()).toBe(false);
      expect(gone.store.roomGone()).toBe(true);
    });
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

  describe('what the server announces', () => {
    async function ready() {
      const store = setup('m-1');
      store.show('r-1');
      await load(store, {
        stage: { speakers: ['h-1'], handRaiseQueue: [] },
        people: [
          { userId: 'h-1', role: 'HOST', status: 'ACTIVE' },
          { userId: 'b-1', role: 'LISTENER', status: 'ACTIVE' },
        ],
      });
      return store;
    }

    it('replaces the stage and the room numbers with the stage an event carries', async () => {
      const store = await ready();

      store.apply({
        type: 'HAND_RAISED',
        at: 10,
        stage: { speakers: ['h-1', 'b-1'], handRaiseQueue: ['c-1', 'd-1'] },
      });

      expect(store.speakers()).toEqual(['h-1', 'b-1']);
      expect(store.queue()).toEqual(['c-1', 'd-1']);
      expect(store.room()).toMatchObject({ speakers: ['h-1', 'b-1'], handRaiseCount: 2 });
      http.expectNone(() => true);
    });

    it('ignores a stage older than the one it already shows', async () => {
      const store = await ready();
      store.apply({
        type: 'STAGE_UPDATED',
        at: 20,
        stage: { speakers: ['h-1', 'b-1'], handRaiseQueue: [] },
      });

      store.apply({
        type: 'STAGE_UPDATED',
        at: 10,
        stage: { speakers: ['h-1'], handRaiseQueue: [] },
      });

      expect(store.speakers()).toEqual(['h-1', 'b-1']);
    });

    it('adds the people who came and removes the ones who left, and keeps the room count', async () => {
      const store = await ready();

      store.apply({
        type: 'PRESENCE_CHANGED',
        participantCount: 3,
        joined: ['c-1', 'b-1'],
        left: ['h-1'],
      });

      expect(store.audience()).toEqual(['b-1', 'c-1']);
      expect(store.room()?.participantCount).toBe(3);
    });

    it('changes the title, topic and seats when the host edits the room', async () => {
      const store = await ready();

      store.apply({ type: 'ROOM_UPDATED', title: 'New title', topic: 'Travel', maxStageSeats: 6 });

      expect(store.room()).toMatchObject({
        title: 'New title',
        topic: 'Travel',
        maxStageSeats: 6,
        participantCount: 3,
      });
    });

    it('marks a speaker as reconnecting, and back', async () => {
      const store = await ready();

      store.apply({ type: 'SPEAKER_RECONNECTING', userId: 'h-1' });
      expect(store.reconnecting()).toEqual(['h-1']);

      store.apply({ type: 'SPEAKER_RECONNECTED', userId: 'h-1' });
      expect(store.reconnecting()).toEqual([]);
    });

    it('goes back to what the server says when the room is read again', async () => {
      const store = await ready();
      store.apply({
        type: 'STAGE_UPDATED',
        at: 20,
        stage: { speakers: ['h-1', 'b-1'], handRaiseQueue: [] },
      });

      await load(store, { stage: { speakers: ['h-1'], handRaiseQueue: ['b-1'] } });

      expect(store.speakers()).toEqual(['h-1']);
      expect(store.queue()).toEqual(['b-1']);
    });
  });

  it('forgets that the person had joined when another room is shown', () => {
    const store = setup();
    store.show('r-1');
    store.markJoined(true);

    store.show('r-2');

    expect(store.joined()).toBe(false);
    expect(store.roomId()).toBe('r-2');
  });

  it('reads everything again when synced after the first time', async () => {
    const store = setup();
    store.show('r-1');
    await load(store);

    store.sync();
    TestBed.tick();

    http.expectOne(BASE);
    http.expectOne(`${BASE}/stage`);
    http.expectOne(`${BASE}/participants`);
  });

  it('keeps reactions on screen until they are settled, and no more than 40 at once', () => {
    const store = setup();
    const reaction = (id: number) => ({ id, userId: 'b-1', reaction: 'HEART' as const });

    store.float([reaction(1), reaction(2)]);
    expect(store.floating().map((r) => r.id)).toEqual([1, 2]);

    expect(store.reactionsByPerson().get('b-1')?.id).toBe(2);

    store.settle(new Set([1]));
    expect(store.floating().map((r) => r.id)).toEqual([2]);

    store.float(Array.from({ length: 50 }, (_, index) => reaction(100 + index)));
    expect(store.floating()).toHaveLength(40);
    expect(store.floating().at(-1)?.id).toBe(149);
  });
});
