import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from '@openng/optimus-ui/api';
import { provideRouter, Router } from '@angular/router';
import { REALTIME_CONNECTOR } from '../../data-access/realtime-connector.token';
import { FakeRealtimeLink } from '../../utils/realtime-link.fake';
import RoomPageComponent from './room-page.component';

@Component({ selector: 'app-stub', template: '' })
class Stub {}

const BASE = '/api/v1/voice-rooms/r-1';

const ROOM = {
  id: 'r-1',
  title: 'Spanish for beginners',
  topic: 'Ordering food',
  hostId: 'h-1',
  targetLanguage: 'es',
  nativeLanguage: 'en',
  maxStageSeats: 4,
  createdAt: '2026-11-14T10:00:00Z',
  speakers: ['h-1'],
  participantCount: 3,
  handRaiseCount: 1,
};

const PEOPLE = [
  { userId: 'h-1', role: 'HOST', status: 'ACTIVE' },
  { userId: 'b-1', role: 'LISTENER', status: 'ACTIVE' },
  { userId: 'm-1', role: 'LISTENER', status: 'ACTIVE' },
];

interface Override {
  status: number;
  body?: object | null;
}

describe('RoomPageComponent (container)', () => {
  let fixture: ComponentFixture<RoomPageComponent>;
  let http: HttpTestingController;
  let requests: { method: string; url: string; body: unknown }[];
  let link: FakeRealtimeLink;
  let server: { room: object; stage: object; people: object[]; session: object };

  const root = () => fixture.nativeElement as HTMLElement;
  const page = () => document.body;
  const sent = (method: string, url: string) =>
    requests.some((r) => r.method === method && r.url === url);
  const body = (method: string, url: string) =>
    requests.find((r) => r.method === method && r.url === url)?.body;
  const buttons = (within: ParentNode = page()) => [
    ...within.querySelectorAll<HTMLButtonElement>('button'),
  ];
  const nameOf = (b: Element) => b.getAttribute('aria-label') ?? b.textContent?.trim() ?? '';
  const press = (label: string, within: ParentNode = page()) =>
    buttons(within)
      .find((b) => nameOf(b).includes(label))!
      .click();
  const controlNames = () =>
    [...root().querySelectorAll('app-room-controls button')].map((b) => nameOf(b));
  const pressHostAction = async (label: string) => {
    press('More actions', root().querySelector('app-room-controls')!);
    await settle();
    await new Promise((resolve) => setTimeout(resolve));
    [...document.querySelectorAll<HTMLElement>('.p-menu-item-link')]
      .find((item) => item.textContent?.includes(label))!
      .click();
  };
  const pressExactlyLast = (label: string) =>
    buttons()
      .filter((b) => b.textContent?.trim() === label)
      .at(-1)!
      .click();

  function asPerson(id: string) {
    localStorage.setItem(
      'jtalk:profile',
      JSON.stringify({
        id,
        name: id === 'h-1' ? 'Hana Host' : 'Mona',
        nativeLanguage: 'ar',
        learning: 'es',
      }),
    );
  }

  function respond(request: TestRequest, overrides: Record<string, Override>) {
    const { method, url } = request.request;
    requests.push({ method, url, body: request.request.body });
    const override = overrides[`${method} ${url}`];
    if (override && override.status >= 400) {
      return request.flush('error', { status: override.status, statusText: 'Error' });
    }
    const answer =
      override?.body ??
      (method === 'POST' && url.endsWith('/participants/join')
        ? server.session
        : method === 'GET' && url === BASE
          ? server.room
          : method === 'GET' && url.endsWith('/stage')
            ? server.stage
            : method === 'GET' && url.endsWith('/participants')
              ? server.people
              : null);
    return request.flush(
      answer,
      answer === null
        ? { status: 204, statusText: 'No Content' }
        : { status: 200, statusText: 'OK' },
    );
  }

  async function settle(overrides: Record<string, Override> = {}) {
    const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
    for (let quiet = 0; quiet < 3;) {
      fixture.detectChanges();
      const pending = http.match(() => true);
      quiet = pending.length === 0 ? quiet + 1 : 0;
      pending.forEach((request) => respond(request, overrides));
      await tick();
    }
    await fixture.whenStable();
  }

  async function open(options: { me?: string; overrides?: Record<string, Override> } = {}) {
    asPerson(options.me ?? 'm-1');
    fixture = TestBed.createComponent(RoomPageComponent);
    fixture.componentRef.setInput('id', 'r-1');
    await settle(options.overrides);
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    requests = [];
    link = new FakeRealtimeLink();
    server = {
      room: ROOM,
      stage: { speakers: ['h-1'], handRaiseQueue: ['b-1'] },
      people: PEOPLE,
      session: {
        room: ROOM,
        role: 'LISTENER',
        canPublishAudio: false,
        liveKitToken: 'x',
        liveKitUrl: 'wss://livekit.test',
      },
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '', component: Stub }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: REALTIME_CONNECTOR, useValue: link.connector },
        MessageService,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => vi.useRealTimers());

  async function openAudience() {
    root().querySelector<HTMLButtonElement>('app-audience-section [aria-expanded]')!.click();
    await settle();
  }

  it('joins the room and shows what it is, who is on stage and who is listening, once the list is opened', async () => {
    await open();

    expect(sent('POST', `${BASE}/participants/join`)).toBe(true);
    expect(root().querySelector('h1')?.textContent).toBe('Spanish for beginners');
    expect(root().textContent).toContain('Ordering food');
    expect(root().querySelectorAll('app-stage-seats .person')).toHaveLength(1);
    expect(root().querySelectorAll('app-stage-seats .seat')).toHaveLength(1);
    expect(root().querySelector('app-audience-grid')).toBeNull();

    await openAudience();
    expect(
      root().querySelector('app-audience-grid [aria-label="Mona (you), Listener"]'),
    ).not.toBeNull();
  });

  it('says what the room is and who hosts it, and shows the requests to the host only', async () => {
    await open();

    expect(root().querySelector('.live')?.textContent).toContain('Live');
    expect(root().querySelector('.meta')?.textContent).toContain('Hosted by h-1');
    expect(root().querySelector('app-raised-hands')).toBeNull();
  });

  it('moves focus to the room title once it has opened, so screen readers announce it', async () => {
    await open();

    expect(document.activeElement).toBe(root().querySelector('h1'));
  });

  it('shows a placeholder, announced as busy, until the room has been joined', async () => {
    asPerson('m-1');
    fixture = TestBed.createComponent(RoomPageComponent);
    fixture.componentRef.setInput('id', 'r-1');
    fixture.detectChanges();

    expect(root().querySelector('p-skeleton')).not.toBeNull();
    expect(root().querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(root().querySelector('h1')).toBeNull();
    await settle();
  });

  it('structures the room with a heading for each part', async () => {
    await open();

    const headings = [...root().querySelectorAll('h2')].map((h) =>
      h.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(headings).toHaveLength(2);
    expect(headings[0]).toBe('On stage 1/4');
    expect(headings[1]).toContain('Listeners');
    expect(root().querySelectorAll('section[aria-labelledby]')).toHaveLength(1);
    expect(root().querySelectorAll('p-card[aria-labelledby]')).toHaveLength(0);
  });

  it('gives a listener a hand to raise, and no host controls or invitations', async () => {
    await open();

    expect(controlNames()).toContain('Raise hand');
    expect(controlNames()).not.toContain('More actions');
    expect(root().querySelector('app-raised-hands button')).toBeNull();
  });

  it('raises a hand and refreshes the room', async () => {
    await open();
    server.stage = { speakers: ['h-1'], handRaiseQueue: ['b-1', 'm-1'] };

    press('Raise hand', root());
    await settle();

    expect(sent('POST', `${BASE}/stage/raise-hand`)).toBe(true);
    expect(
      root().querySelector('app-room-controls button[aria-pressed]')?.getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('takes a free seat', async () => {
    await open();
    server.stage = { speakers: ['h-1', 'm-1'], handRaiseQueue: ['b-1'] };

    root().querySelector<HTMLButtonElement>('app-stage-seats .seat')!.click();
    await settle();

    expect(sent('POST', `${BASE}/stage/join`)).toBe(true);
    expect(root().querySelectorAll('app-stage-seats .person')).toHaveLength(2);
    expect(controlNames()).not.toContain('Raise hand');
  });

  it('names each open seat by its number, for screen readers', async () => {
    await open();

    expect(
      [...root().querySelectorAll('app-stage-seats .seat')].map((s) =>
        s.getAttribute('aria-label'),
      ),
    ).toEqual(['Take free seat 2 of 4']);
  });

  it('shows a message, and keeps the room, when an action fails', async () => {
    await open();

    press('Raise hand', root());
    await settle({ [`POST ${BASE}/stage/raise-hand`]: { status: 500 } });

    expect(root().textContent).toContain('Could not raise your hand.');
    expect(root().querySelector('h1')).not.toBeNull();
  });

  it('leaves quietly and goes back to the hallway', async () => {
    await open();

    press('Leave quietly', root());
    await settle();

    expect(sent('POST', `${BASE}/participants/leave`)).toBe(true);
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('checks the room now and then in case it missed something', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await open();
    requests.length = 0;

    vi.advanceTimersByTime(30_000);
    await settle();

    expect(sent('GET', `${BASE}/stage`)).toBe(true);
    expect(sent('GET', `${BASE}/participants`)).toBe(true);
  });

  it('tells screen readers who raised a hand or took a seat, once, politely', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    asPerson('h-1');
    await open({ me: 'h-1' });
    const live = () => document.querySelector('.cdk-live-announcer-element')?.textContent ?? '';

    link.last.listener.roomEvent({
      type: 'HAND_RAISED',
      at: Date.now(),
      stage: { speakers: ['h-1', 'b-1'], handRaiseQueue: ['c-1'] },
    });
    await settle();
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(live()).toContain('c-1 raised a hand.');
    expect(live()).toContain('b-1 joined the stage.');
  });

  it('goes back to the hallway, and says why, when the host removes the person', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await open();
    const toast = vi.spyOn(TestBed.inject(MessageService), 'add');

    link.last.listener.connectionLost();
    TestBed.tick();
    vi.advanceTimersByTime(3000);
    await settle({ [`POST ${BASE}/participants/join`]: { status: 403 } });

    expect(TestBed.inject(Router).url).toBe('/');
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ summary: 'The host removed you from this room.' }),
    );
  });

  it('refuses to show a room the person was removed from', async () => {
    await open({ overrides: { [`POST ${BASE}/participants/join`]: { status: 403 } } });

    expect(root().textContent).toContain('The host removed you from this room.');
    expect(root().querySelector('h1')).toBeNull();
    expect(root().querySelector('a[href="/"]')).not.toBeNull();
  });

  it('goes back to the hallway when the room has ended', async () => {
    await open({ overrides: { [`GET ${BASE}`]: { status: 404 } } });

    expect(TestBed.inject(Router).url).toBe('/');
  });

  describe('as the host', () => {
    const asHost = { me: 'h-1' };

    it('offers the room controls, and an Invite for each raised hand', async () => {
      await open(asHost);

      expect(controlNames()).toContain('More actions');
      expect(root().querySelector('app-raised-hands button')?.getAttribute('aria-label')).toBe(
        'Invite b-1 to the stage',
      );
    });

    it('invites someone to the stage', async () => {
      await open(asHost);
      server.stage = { speakers: ['h-1', 'b-1'], handRaiseQueue: [] };

      root().querySelector<HTMLButtonElement>('app-raised-hands button')!.click();
      await settle();

      expect(sent('POST', `${BASE}/stage/promote/b-1`)).toBe(true);
      expect(root().querySelectorAll('app-stage-seats .person')).toHaveLength(2);
    });

    it('removes someone only after asking', async () => {
      await open(asHost);
      await openAudience();
      [...root().querySelectorAll<HTMLButtonElement>('app-audience-grid .person')]
        .find((p) => p.textContent?.includes('b-1'))!
        .click();
      await settle();

      press('Remove from the room');
      await settle();
      expect(page().textContent).toContain('will leave the room and cannot come back.');
      expect(sent('DELETE', `${BASE}/participants/b-1`)).toBe(false);

      pressExactlyLast('Remove');
      await settle();
      expect(sent('DELETE', `${BASE}/participants/b-1`)).toBe(true);
    });

    it('ends the room only after asking, and goes back to the hallway', async () => {
      await open(asHost);

      await pressHostAction('End the room');
      await settle();
      expect(page().textContent).toContain('The room closes for everyone in it.');
      expect(sent('DELETE', BASE)).toBe(false);

      pressExactlyLast('End the room');
      await settle();

      expect(sent('DELETE', BASE)).toBe(true);
      expect(TestBed.inject(Router).url).toBe('/');
    });

    it('edits the room', async () => {
      await open(asHost);

      await pressHostAction('Edit the room');
      await settle();
      const title = page().querySelector<HTMLInputElement>('app-room-form input')!;
      expect(title.value).toBe('Spanish for beginners');
      title.value = 'Spanish II';
      title.dispatchEvent(new Event('input'));
      title.dispatchEvent(new Event('blur'));
      await fixture.whenStable();
      server.room = { ...ROOM, title: 'Spanish II' };

      page()
        .querySelector('app-room-form form')!
        .dispatchEvent(new Event('submit', { cancelable: true }));
      await settle({ [`PATCH ${BASE}`]: { status: 200, body: server.room } });

      expect(body('PATCH', BASE)).toEqual({
        title: 'Spanish II',
        topic: 'Ordering food',
        maxStageSeats: 4,
      });
      expect(root().querySelector('h1')?.textContent).toBe('Spanish II');
    });
  });
  describe('audio', () => {
    const speakerSession = () => ({
      ...server.session,
      role: 'SPEAKER',
      canPublishAudio: true,
    });
    const controls = () => root().querySelector('app-room-controls')!;
    const controlLabels = () => [...controls().querySelectorAll('button')].map((b) => nameOf(b));

    it('connects to the room audio with the address and token the backend gave', async () => {
      await open();

      expect(link.connections).toHaveLength(1);
      expect(link.last).toMatchObject({ url: 'wss://livekit.test', token: 'x' });
      expect(controls().querySelector('.notes')?.textContent?.trim()).toBe('');
    });

    it('gives a listener no microphone button', async () => {
      await open();

      expect(controlLabels()).not.toContain('Mute');
      expect(controlLabels()).not.toContain('Unmute');
      expect(link.last.microphone).toEqual([]);
    });

    it('opens the microphone of a speaker, who can mute and unmute from the controls', async () => {
      server.session = speakerSession();
      server.stage = { speakers: ['h-1', 'm-1'], handRaiseQueue: [] };
      await open();

      expect(link.last.microphone).toEqual([true]);
      expect(controlLabels()).toContain('Mute');

      press('Mute', root());
      await settle();
      expect(link.last.microphone).toEqual([true, false]);
      expect(controlLabels()).toContain('Unmute');
    });

    it('lets a listener speak the moment the server gives them a seat', async () => {
      await open();
      expect(controlLabels()).not.toContain('Mute');

      link.last.listener.canPublishChanged(true);
      await settle();

      expect(link.last.microphone).toEqual([true]);
      expect(controlLabels()).toContain('Mute');
    });

    it('shows what the server announces at once, without asking for it again', async () => {
      await open();
      requests.length = 0;

      link.last.listener.roomEvent({
        type: 'STAGE_UPDATED',
        at: Date.now(),
        stage: { speakers: ['h-1', 'b-1'], handRaiseQueue: [] },
      });
      await settle();

      expect(sent('GET', `${BASE}/stage`)).toBe(false);
      expect(root().querySelectorAll('app-stage-seats .person')).toHaveLength(2);
    });

    it('shows who is speaking on the stage', async () => {
      await open();
      expect(root().querySelector('app-stage-seats .person.speaking')).toBeNull();

      link.last.listener.speakersChanged(['h-1']);
      await settle();

      expect(root().querySelectorAll('app-stage-seats .person.speaking')).toHaveLength(1);
      expect(root().querySelector('app-stage-seats app-person-avatar.speaking')).not.toBeNull();

      link.last.listener.speakersChanged([]);
      await settle();
      expect(root().querySelector('app-stage-seats .person.speaking')).toBeNull();
    });

    it('asks for a tap when the browser blocks sound, and starts the sound from it', async () => {
      await open();
      link.last.listener.soundBlocked(true);
      await settle();

      press('Turn on sound', root());
      await settle();

      expect(link.last.soundStarts).toBe(1);
      expect(controlLabels()).not.toContain('Turn on sound');
    });

    it('says so, and offers to reconnect, when the audio is lost', async () => {
      await open();

      link.last.listener.connectionLost();
      await settle();
      expect(controls().textContent).toContain('Audio is not available.');

      press('Reconnect audio', root());
      await settle();
      expect(link.connections).toHaveLength(2);
      expect(controls().querySelector('.notes')?.textContent?.trim()).toBe('');
    });

    it('keeps the room usable when the audio cannot connect at all', async () => {
      link.connectFailure = new Error('unreachable');
      await open();

      expect(controls().textContent).toContain('Audio is not available.');
      expect(root().querySelector('h1')?.textContent).toBe('Spanish for beginners');
    });

    it('warns, and tells them what to do, when the browser refuses the microphone', async () => {
      server.session = speakerSession();
      server.stage = { speakers: ['h-1', 'm-1'], handRaiseQueue: [] };
      link.microphoneFailure = new Error('NotAllowedError');
      const toast = vi.spyOn(TestBed.inject(MessageService), 'add');
      await open();

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: 'We could not use your microphone. Allow it in your browser, then press Unmute.',
        }),
      );
      expect(controlLabels()).toContain('Unmute');
    });

    it('hangs up when the person leaves, is removed, or the room ends', async () => {
      await open();
      press('Leave quietly', root());
      await settle();
      expect(link.last.disconnected).toBe(true);
    });

    it('hangs up when the page goes away', async () => {
      await open();

      fixture.destroy();

      expect(link.last.disconnected).toBe(true);
    });
  });
});
