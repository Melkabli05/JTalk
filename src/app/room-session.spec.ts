import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MessageService } from '@openng/optimus-ui/api';
import { fakeAuth0, fakeIdentity } from '@core/auth/auth-testing';
import { REALTIME_CONNECTOR } from './features/rooms/data-access/realtime-connector.token';
import { ROOMS_ROUTES } from './features/rooms/rooms.routes';
import { FakeRealtimeLink } from './features/rooms/utils/realtime-link.fake';
import { layoutRoutes } from './layout/layout.routes';

const BASE = '/api/v1/voice-rooms/r-1';
const ROOM = {
  id: 'r-1',
  title: 'Spanish coffee',
  topic: '',
  hostId: 'h-1',
  targetLanguage: 'es',
  nativeLanguage: 'en',
  maxStageSeats: 4,
  createdAt: '2026-11-14T10:00:00Z',
  speakers: ['h-1'],
  participantCount: 2,
  handRaiseCount: 0,
};
const SESSION = {
  room: ROOM,
  role: 'LISTENER',
  canPublishAudio: false,
  liveKitToken: 'x',
  liveKitUrl: 'wss://livekit.test',
};

/**
 * The whole path, through the real router, the real shell and the real room page: being in a room, going to another page, coming back.
 * (Everything else about rooms is covered where it lives; this is the promise the person is given: leaving the page does not leave the room.)
 */
describe('Staying in a room while looking at other pages', () => {
  let http: HttpTestingController;
  let link: FakeRealtimeLink;
  let sent: { method: string; url: string }[];
  let harness: RouterTestingHarness;
  const page = () => harness.routeNativeElement!;
  /** The way back to the room: the sidebar's Go live card turns into it while the person is in a room elsewhere. */
  const badge = () =>
    [...page().querySelectorAll<HTMLButtonElement>('app-sidebar .go-live button')].find((b) =>
      b.textContent?.includes('Back to the room'),
    ) ?? null;
  const count = (method: string, suffix: string) =>
    sent.filter((r) => r.method === method && r.url.endsWith(suffix)).length;

  function answer(request: TestRequest) {
    const { method, url } = request.request;
    sent.push({ method, url });
    const body =
      method === 'POST' && url === `${BASE}/participants/join`
        ? SESSION
        : method === 'GET' && url === BASE
          ? ROOM
          : method === 'GET' && url === `${BASE}/stage`
            ? { speakers: ['h-1'], handRaiseQueue: [] }
            : method === 'GET' && url === `${BASE}/participants`
              ? [
                  { userId: 'h-1', role: 'HOST', status: 'ACTIVE' },
                  { userId: 'm-1', role: 'LISTENER', status: 'ACTIVE' },
                ]
              : null;
    request.flush(
      body,
      body === null ? { status: 204, statusText: 'No Content' } : { status: 200, statusText: 'OK' },
    );
  }

  async function settle() {
    for (let quiet = 0; quiet < 3;) {
      TestBed.tick();
      const pending = http.match(() => true);
      quiet = pending.length === 0 ? quiet + 1 : 0;
      pending.forEach(answer);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    await harness.fixture.whenStable();
  }

  async function go(url: string) {
    await harness.navigateByUrl(url);
    await settle();
  }

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('jtalk:locale', 'en');
    sent = [];
    link = new FakeRealtimeLink();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        fakeAuth0(),
        fakeIdentity({ id: 'm-1', name: 'Mona', nativeLanguage: 'ar', learning: 'es', avatar: '' })
          .provider,
        { provide: REALTIME_CONNECTOR, useValue: link.connector },
        { provide: MessageService, useValue: { add: vi.fn() } },
        provideRouter(
          layoutRoutes([
            ...ROOMS_ROUTES,
            { path: 'people', children: [] },
            { path: 'profile', children: [] },
          ]),
          withComponentInputBinding(),
        ),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  it('keeps the room, its audio and the person in it when they go to another page, shows a way back in the sidebar, and returns to the same room', async () => {
    await go('/rooms/r-1');
    expect(count('POST', '/participants/join')).toBe(1);
    expect(page().textContent).toContain('Spanish coffee');
    expect(badge(), 'no badge on the room itself').toBeNull();
    expect(link.last.disconnected).toBe(false);

    await go('/people');
    expect(TestBed.inject(Router).url).toBe('/people');
    expect(count('POST', '/participants/leave'), 'nobody was told the person left').toBe(0);
    expect(link.last.disconnected, 'the audio is still connected').toBe(false);
    expect(page().querySelector('app-sidebar .go-live')?.textContent).toContain('Spanish coffee');

    await go('/profile');
    expect(badge(), 'and on every other page').not.toBeNull();

    // The hallway keeps asking for its rooms, so this waits a moment rather than for quiet.
    await harness.navigateByUrl('/');
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    TestBed.tick();
    http.match(() => true).forEach(answer);
    expect(TestBed.inject(Router).url).toBe('/');
    expect(badge(), 'also on the hallway, where people go to look at other rooms').not.toBeNull();
    expect(count('POST', '/participants/leave')).toBe(0);
    expect(link.last.disconnected).toBe(false);

    badge()!.click();
    await settle();
    expect(TestBed.inject(Router).url).toBe('/rooms/r-1');
    expect(page().textContent).toContain('Spanish coffee');
    expect(count('POST', '/participants/join'), 'not joined again').toBe(1);
    expect(link.connections, 'no second audio connection').toHaveLength(1);
    expect(link.last.disconnected).toBe(false);
    expect(badge()).toBeNull();
  });

  it('leaves the room only when the person leaves it, and the badge goes with it', async () => {
    await go('/rooms/r-1');
    await go('/people');
    expect(badge()).not.toBeNull();

    badge()!.click();
    await settle();
    [...page().querySelectorAll<HTMLButtonElement>('app-room-controls button')]
      .find((b) => b.getAttribute('aria-label') === 'Leave quietly')!
      .click();
    // The hallway the person lands on keeps asking for its rooms, so this waits a moment rather than for quiet.
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    TestBed.tick();
    http.match(() => true).forEach(answer);

    expect(count('POST', '/participants/leave')).toBe(1);
    expect(link.last.disconnected).toBe(true);
    expect(TestBed.inject(Router).url).toBe('/');
    expect(badge()).toBeNull();
  });
});
