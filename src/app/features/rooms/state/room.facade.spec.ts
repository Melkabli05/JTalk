import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { REALTIME_CONNECTOR } from '../data-access/realtime-connector.token';
import { FakeRealtimeLink } from '../data-access/realtime-link.fake';
import { provideRoom, RoomFacade, type RoomExit } from './room.facade';

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
  participantCount: 1,
  handRaiseCount: 0,
};
const SESSION = {
  room: ROOM,
  role: 'LISTENER',
  canPublishAudio: false,
  liveKitToken: 'token-1',
  liveKitUrl: 'wss://livekit.test',
};

describe('RoomFacade', () => {
  let http: HttpTestingController;
  let link: FakeRealtimeLink;
  let facade: RoomFacade;
  let sent: { method: string; url: string; body: unknown }[];
  let failing: Record<string, number>;
  let exits: RoomExit[];

  const count = (method: string, url: string) =>
    sent.filter((r) => r.method === method && r.url === url).length;

  function answer(request: TestRequest) {
    const { method, url } = request.request;
    sent.push({ method, url, body: request.request.body });
    const status = failing[`${method} ${url}`];
    if (status) {
      return request.flush('error', { status, statusText: 'Error' });
    }
    const body =
      method === 'POST' && url.endsWith('/participants/join')
        ? SESSION
        : method === 'PATCH'
          ? ROOM
          : method === 'GET' && url === BASE
            ? ROOM
            : method === 'GET' && url.endsWith('/stage')
              ? { speakers: ['h-1'], handRaiseQueue: [] }
              : method === 'GET' && url.endsWith('/participants')
                ? []
                : null;
    return request.flush(
      body,
      body === null ? { status: 204, statusText: 'No Content' } : { status: 200, statusText: 'OK' },
    );
  }

  /** Answers everything asked, until nothing more is. Reloads are asked a moment after an answer. */
  async function settle() {
    const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
    for (let quiet = 0; quiet < 3;) {
      TestBed.tick();
      const pending = http.match(() => true);
      quiet = pending.length === 0 ? quiet + 1 : 0;
      pending.forEach(answer);
      await tick();
    }
  }

  async function enter() {
    facade.enter('r-1');
    await settle();
  }

  /** A fresh facade, as a page would get it. Fake timers must be installed before this, to fake its refresh timer. */
  function build() {
    TestBed.resetTestingModule();
    link = new FakeRealtimeLink();
    exits = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: REALTIME_CONNECTOR, useValue: link.connector },
        provideRoom(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    facade = TestBed.inject(RoomFacade);
    facade.exited.subscribe((reason) => exits.push(reason));
  }

  function withFakeTimers() {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    build();
  }

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'jtalk:profile',
      JSON.stringify({ id: 'm-1', name: 'Me', nativeLanguage: 'ar', learning: 'es', avatar: '' }),
    );
    sent = [];
    failing = {};
    build();
  });
  afterEach(() => vi.useRealTimers());

  it('joins the room it is told to enter, shows it, and connects its audio', async () => {
    await enter();

    expect(count('POST', `${BASE}/participants/join`)).toBe(1);
    expect(facade.state.joined()).toBe(true);
    expect(facade.state.room()?.id).toBe('r-1');
    expect(link.last).toMatchObject({ url: 'wss://livekit.test', token: 'token-1' });
    expect(facade.audio.status()).toBe('connected');
  });

  it('says why when it cannot join', async () => {
    failing[`POST ${BASE}/participants/join`] = 403;
    await enter();
    expect(facade.joining.error()).toBe('The host removed you from this room.');
    expect(facade.state.joined()).toBe(false);
    expect(link.connections).toHaveLength(0);

    failing[`POST ${BASE}/participants/join`] = 404;
    await enter();
    expect(facade.joining.error()).toBe('This room has ended.');

    failing[`POST ${BASE}/participants/join`] = 500;
    await enter();
    expect(facade.joining.error()).toBe('Could not join the room. Please try again.');
  });

  it('says "still here" and refreshes every few seconds, once joined', async () => {
    withFakeTimers();
    await enter();
    sent.length = 0;

    vi.advanceTimersByTime(3000);
    await settle();

    expect(count('POST', `${BASE}/participants/heartbeat`)).toBe(1);
    expect(count('GET', BASE)).toBe(1);
    expect(count('GET', `${BASE}/stage`)).toBe(1);
    expect(count('GET', `${BASE}/participants`)).toBe(1);
  });

  it('does not say "still here" before it has joined', async () => {
    withFakeTimers();
    failing[`POST ${BASE}/participants/join`] = 500;
    await enter();
    sent.length = 0;

    vi.advanceTimersByTime(3000);
    await settle();

    expect(count('POST', `${BASE}/participants/heartbeat`)).toBe(0);
  });

  it('refreshes at once when the server announces a change', async () => {
    await enter();
    sent.length = 0;

    link.last.listener.roomEvent();
    await settle();

    expect(count('GET', `${BASE}/stage`)).toBe(1);
    expect(count('GET', `${BASE}/participants`)).toBe(1);
  });

  describe('when the person is pushed out', () => {
    it('reports "removed" once, hangs up, and does not say goodbye, when the host removes them', async () => {
      withFakeTimers();
      await enter();
      failing[`POST ${BASE}/participants/heartbeat`] = 403;

      vi.advanceTimersByTime(3000);
      await settle();
      vi.advanceTimersByTime(3000);
      await settle();

      expect(exits).toEqual(['removed']);
      expect(facade.state.joined()).toBe(false);
      expect(link.last.disconnected).toBe(true);
      expect(count('POST', `${BASE}/participants/leave`)).toBe(0);
    });

    it('reports "ended" when the room is gone, by the heartbeat or by the room itself', async () => {
      withFakeTimers();
      await enter();
      failing[`GET ${BASE}`] = 404;

      vi.advanceTimersByTime(3000);
      await settle();

      expect(exits).toEqual(['ended']);
    });

    it('reports "closed" once the host has ended the room', async () => {
      await enter();

      facade.close();
      await settle();

      expect(count('DELETE', BASE)).toBe(1);
      expect(exits).toEqual(['closed']);
      expect(link.last.disconnected).toBe(true);
      expect(count('POST', `${BASE}/participants/leave`)).toBe(0);
    });
  });

  describe('what the person and the host do', () => {
    it.each([
      ['raises a hand', () => facade.raiseHand(), 'POST', `${BASE}/stage/raise-hand`],
      ['lowers it', () => facade.lowerHand(), 'DELETE', `${BASE}/stage/raise-hand`],
      ['takes a seat', () => facade.takeSeat(), 'POST', `${BASE}/stage/join`],
      ['steps down', () => facade.stepDown(), 'POST', `${BASE}/stage/leave`],
      ['invites someone', () => facade.invite('b-1'), 'POST', `${BASE}/stage/promote/b-1`],
      ['moves a speaker down', () => facade.demote('b-1'), 'POST', `${BASE}/stage/demote/b-1`],
      ['removes someone', () => facade.remove('b-1'), 'DELETE', `${BASE}/participants/b-1`],
    ])('%s, and refreshes the room', async (_name, act, method, url) => {
      await enter();
      sent.length = 0;

      act();
      await settle();

      expect(count(method, url)).toBe(1);
      expect(count('GET', `${BASE}/stage`)).toBe(1);
      expect(facade.action.error()).toBeNull();
    });

    it('says what went wrong, and keeps the room, when a request fails', async () => {
      await enter();
      failing[`POST ${BASE}/stage/raise-hand`] = 500;

      facade.raiseHand();
      await settle();

      expect(facade.action.error()).toBe('Could not raise your hand. Please try again.');
      expect(facade.state.joined()).toBe(true);
      expect(exits).toEqual([]);
    });

    it('saves an edit of the room, refreshes it, and then tells the page', async () => {
      await enter();
      const done = vi.fn();

      facade.edit({ title: 'New', topic: 't', maxStageSeats: 5 }, done);
      await settle();

      expect(sent.find((r) => r.method === 'PATCH')?.body).toEqual({
        title: 'New',
        topic: 't',
        maxStageSeats: 5,
      });
      expect(done).toHaveBeenCalledOnce();
    });

    it('says so, and does not tell the page, when an edit fails', async () => {
      await enter();
      failing[`PATCH ${BASE}`] = 500;
      const done = vi.fn();

      facade.edit({ title: 'New', topic: 't', maxStageSeats: 5 }, done);
      await settle();

      expect(facade.saving.error()).toBe('Could not save the room. Please try again.');
      expect(done).not.toHaveBeenCalled();
    });
  });

  describe('the audio', () => {
    it('lets a speaker mute and unmute, and a listener neither', async () => {
      await enter();
      await facade.audio.toggleMicrophone();
      await settle();
      expect(link.last.microphone).toEqual([]);

      link.last.listener.canPublishChanged(true);
      await settle();
      await facade.audio.toggleMicrophone();
      await settle();

      expect(link.last.microphone).toEqual([true, false]);
    });

    it('starts blocked sound, and connects again when the connection is lost', async () => {
      await enter();
      link.last.listener.soundBlocked(true);
      await facade.audio.enableSound();
      await settle();
      expect(link.last.soundStarts).toBe(1);

      link.last.listener.connectionLost();
      facade.reconnectAudio();
      await settle();
      expect(link.connections).toHaveLength(2);
      expect(facade.audio.status()).toBe('connected');
    });

    it('asks the backend for a fresh token to reconnect, since the first one is short-lived', async () => {
      await enter();
      link.last.listener.connectionLost();
      sent.length = 0;

      facade.reconnectAudio();
      await settle();

      expect(count('POST', `${BASE}/participants/join`)).toBe(1);
      expect(link.connections).toHaveLength(2);
    });

    it('does not reconnect the audio of someone the host removed, or of a room that has ended', async () => {
      await enter();
      link.last.listener.connectionLost();
      failing[`POST ${BASE}/participants/join`] = 403;

      facade.reconnectAudio();
      await settle();

      expect(exits).toEqual(['removed']);
      expect(link.connections).toHaveLength(1);
    });
  });

  describe('leaving', () => {
    it('hangs up and says goodbye once, however many times it is asked', async () => {
      await enter();

      facade.leave();
      facade.leave();
      await settle();

      expect(count('POST', `${BASE}/participants/leave`)).toBe(1);
      expect(link.last.disconnected).toBe(true);
    });

    it('does not say goodbye to a room it never joined', async () => {
      failing[`POST ${BASE}/participants/join`] = 500;
      await enter();

      facade.leave();
      await settle();

      expect(count('POST', `${BASE}/participants/leave`)).toBe(0);
    });

    it('hangs up and says goodbye when the page goes away', async () => {
      await enter();

      TestBed.resetTestingModule();
      await Promise.resolve();

      expect(link.last.disconnected).toBe(true);
    });

    it('can enter another room afterwards', async () => {
      await enter();
      facade.leave();
      await settle();
      sent.length = 0;

      await enter();

      expect(count('POST', `${BASE}/participants/join`)).toBe(1);
      expect(facade.state.joined()).toBe(true);
    });
  });
});
