import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { fakeIdentity } from '@core/auth/auth-testing';
import { REALTIME_CONNECTOR } from '../data-access/realtime-connector.token';
import { FakeRealtimeLink } from '../utils/realtime-link.fake';
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

  function build() {
    TestBed.resetTestingModule();
    link = new FakeRealtimeLink();
    exits = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        fakeIdentity({ id: 'm-1', name: 'Me', nativeLanguage: 'ar', learning: 'es', avatar: '' })
          .provider,
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

  it('re-reads the room now and then, once joined, in case it missed something', async () => {
    withFakeTimers();
    await enter();
    sent.length = 0;

    vi.advanceTimersByTime(30_000);
    await settle();

    expect(count('GET', BASE)).toBe(1);
    expect(count('GET', `${BASE}/stage`)).toBe(1);
    expect(count('GET', `${BASE}/participants`)).toBe(1);
  });

  it('does not re-read the room before it has joined', async () => {
    withFakeTimers();
    failing[`POST ${BASE}/participants/join`] = 500;
    await enter();
    sent.length = 0;

    vi.advanceTimersByTime(30_000);
    await settle();

    expect(count('GET', BASE)).toBe(0);
  });

  it('joins again to get its audio back when the link is lost, and gives up after a few tries', async () => {
    withFakeTimers();
    await enter();
    link.connectFailure = new Error('unreachable');

    link.last.listener.connectionLost();
    for (let attempt = 0; attempt < 6; attempt++) {
      TestBed.tick();
      vi.advanceTimersByTime(3000);
      await settle();
    }

    expect(count('POST', `${BASE}/participants/join`)).toBe(1 + 3);
  });

  it('applies what the server announces without asking for it again', async () => {
    await enter();
    sent.length = 0;

    link.last.listener.roomEvent({
      type: 'HAND_RAISED',
      at: Date.now(),
      stage: { speakers: ['h-1'], handRaiseQueue: ['b-1'] },
    });
    await settle();

    expect(facade.state.queue()).toEqual(['b-1']);
    expect(sent).toEqual([]);
  });

  it('reads the room again whenever its audio link comes back, in case it missed something', async () => {
    await enter();
    sent.length = 0;

    link.last.listener.linkChanged(false);
    link.last.listener.linkChanged(true);
    await settle();

    expect(count('GET', `${BASE}/stage`)).toBe(1);
  });

  describe('when the person is pushed out', () => {
    it('reports "removed" once, stops the audio, and does not say goodbye, when the host removes them', async () => {
      withFakeTimers();
      await enter();
      failing[`POST ${BASE}/participants/join`] = 403;

      link.last.listener.connectionLost();
      TestBed.tick();
      vi.advanceTimersByTime(3000);
      await settle();

      expect(exits).toEqual(['removed']);
      expect(facade.state.joined()).toBe(false);
      expect(facade.audio.status()).toBe('idle');
      expect(count('POST', `${BASE}/participants/leave`)).toBe(0);
    });

    it('reports "ended" when the room is gone, found by reading it or by joining again after the link dropped', async () => {
      withFakeTimers();
      await enter();
      failing[`GET ${BASE}`] = 404;

      vi.advanceTimersByTime(30_000);
      await settle();

      expect(exits).toEqual(['ended']);

      build();
      await enter();
      failing[`POST ${BASE}/participants/join`] = 404;

      link.last.listener.connectionLost();
      TestBed.tick();
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

  describe('reactions', () => {
    it('shows what the server announces and takes it away after a moment', async () => {
      withFakeTimers();
      await enter();

      link.last.listener.roomEvent({
        type: 'REACTIONS',
        reactions: [
          { userId: 'b-1', reaction: 'HEART' },
          { userId: 'm-1', reaction: 'SMILE' },
        ],
      });
      expect(facade.state.floating().map((r) => r.reaction)).toEqual(['HEART', 'SMILE']);

      vi.advanceTimersByTime(2400);
      expect(facade.state.floating()).toEqual([]);
    });

    it('sends a reaction to the room, and waits for the server to announce it before showing it', async () => {
      await enter();

      facade.react('HEART');
      await settle();

      expect(sent.find((r) => r.url === `${BASE}/reactions`)?.body).toEqual({ reaction: 'HEART' });
      expect(facade.state.floating()).toEqual([]);
    });

    it('does not send a second reaction within half a second, and does again after that', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      build();
      await enter();

      facade.react('HEART');
      facade.react('SMILE');
      await settle();
      expect(count('POST', `${BASE}/reactions`)).toBe(1);

      vi.advanceTimersByTime(600);
      facade.react('SMILE');
      await settle();
      expect(count('POST', `${BASE}/reactions`)).toBe(2);
    });

    it('stays quiet when the server says to slow down', async () => {
      await enter();
      failing[`POST ${BASE}/reactions`] = 429;

      facade.react('HEART');
      await settle();

      expect(facade.action.error()).toBeNull();
    });

    it('sends nothing before the person has joined the room', () => {
      facade.react('HEART');

      expect(count('POST', `${BASE}/reactions`)).toBe(0);
    });
  });
});
