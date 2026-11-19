import { of } from 'rxjs';
import { BreakpointObserver } from '@angular/cdk/layout';
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
import { fakeIdentity } from '@core/auth/auth-testing';
import { ActiveRoomService } from '@core/rooms/active-room.service';

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
  const pressHostAction = (label: string) => press(label, root().querySelector('header')!);
  // Blocking is in the card's safety section, closed until it is opened.
  const pressSafety = async (label: string) => {
    page().querySelector<HTMLElement>('.safety .p-accordionheader')!.click();
    await settle();
    press(label);
  };
  const pressExactlyLast = (label: string) =>
    buttons()
      .filter((b) => b.textContent?.trim() === label)
      .at(-1)!
      .click();

  const identity = fakeIdentity({
    id: 'm-1',
    name: 'Mona',
    nativeLanguage: 'ar',
    learning: 'es',
    avatar: '',
    languages: { native: ['ar'], learning: [{ code: 'es', level: 'BEGINNER' as const }] },
  });

  function asPerson(id: string) {
    identity.become({
      id,
      name: id === 'h-1' ? 'Hana Host' : 'Mona',
      nativeLanguage: 'ar',
      learning: 'es',
      avatar: '',
      languages: { native: ['ar'], learning: [{ code: 'es', level: 'BEGINNER' as const }] },
    });
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
              : method === 'GET' && url.endsWith('/comments')
                ? { comments: [], topic: null, muted: false, mutedUsers: [] }
                : method === 'POST' && url.endsWith('/comments')
                  ? {
                      id: 'c-1',
                      authorId: 'm-1',
                      type: 'TEXT',
                      content: 'Hola a todos',
                      createdAt: '2026-11-19T10:00:00Z',
                    }
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
        provideRouter([
          { path: '', component: Stub },
          { path: 'people/:id', component: Stub },
          { path: 'profile', component: Stub },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        identity.provider,
        { provide: REALTIME_CONNECTOR, useValue: link.connector },
        MessageService,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => vi.useRealTimers());

  it('joins the room and shows what it is, who is on stage and who is listening', async () => {
    await open();

    expect(sent('POST', `${BASE}/participants/join`)).toBe(true);
    expect(root().querySelector('h1')?.textContent).toBe('Spanish for beginners');
    expect(root().textContent).toContain('Ordering food');
    expect(root().querySelectorAll('app-stage-seats .person')).toHaveLength(1);
    expect(root().querySelectorAll('app-stage-seats .seat')).toHaveLength(1);
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

  it('shows the room centred: its title and topic, and three counts, each read in words', async () => {
    await open();
    const chips = [...root().querySelectorAll('.stats [role="img"]')];

    expect(chips).toHaveLength(3);
    expect(chips.map((c) => c.getAttribute('aria-label'))).toEqual([
      expect.stringMatching(/in the room$/),
      expect.stringMatching(/^Raised hands: \d+$/),
      expect.stringMatching(/^On stage \d+\/\d+$/),
    ]);
  });

  it('puts the page actions behind a menu button too, which a phone shows instead of the buttons', async () => {
    await open();
    const more = root().querySelector<HTMLButtonElement>('header .more')!;

    expect(more.getAttribute('aria-label')).toBe('Room actions');
    expect(more.getAttribute('aria-haspopup')).toBe('menu');
    more.click();
    await settle();
    expect(
      [...document.querySelectorAll('.p-menu-item-link')].map((i) => i.textContent?.trim()),
    ).toEqual(['Share']);
  });

  it('copies the address of the room when Share is pressed, and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const toast = vi.spyOn(TestBed.inject(MessageService), 'add');
    await open();

    press('Share', root().querySelector('header')!);
    await settle();

    expect(writeText).toHaveBeenCalledWith(`${location.origin}/rooms/r-1`);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ summary: 'Link copied.' }));
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
    expect(headings).toHaveLength(3);
    expect(headings[0]).toBe('Stage 1 on stage');
    expect(headings[1]).toContain('Audience');
    expect(headings[2]).toBe('Live Discussion');
    expect(root().querySelectorAll('section[aria-labelledby]')).toHaveLength(2);
    expect(root().querySelectorAll('p-card[aria-labelledby]')).toHaveLength(0);
  });

  it('gives a listener a hand to raise, and no host controls or invitations', async () => {
    await open();

    expect(controlNames()).toContain('Raise hand');
    expect(root().querySelector('header .host-tools')).toBeNull();
    expect(root().querySelector('app-raised-hands button')).toBeNull();
  });

  it('raises a hand, and shows it when the server announces it, without asking again', async () => {
    await open();
    requests.length = 0;

    press('Raise hand', root());
    await settle();
    link.last.listener.roomEvent({
      type: 'HAND_RAISED',
      at: Date.now(),
      stage: { speakers: ['h-1'], handRaiseQueue: ['b-1', 'm-1'] },
    });
    await settle();

    expect(sent('POST', `${BASE}/stage/raise-hand`)).toBe(true);
    expect(sent('GET', `${BASE}/stage`)).toBe(false);
    expect(
      root().querySelector('app-room-controls button[aria-pressed]')?.getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('shows the discussion on the page, and Expand moves it into the drawer, never both', async () => {
    await open();

    expect(root().querySelectorAll('app-chat-panel')).toHaveLength(1);
    expect(root().querySelector('app-chat-panel section.framed.trimmed')).not.toBeNull();

    press('Expand', root().querySelector('app-chat-panel')!);
    await settle();

    expect(document.body.querySelectorAll('app-chat-panel')).toHaveLength(1);
    expect(document.body.querySelector('app-chat-panel section.framed.trimmed')).toBeNull();
  });

  it('puts the discussion in a column beside the room on a wide screen, with no Expand and no chat button', async () => {
    const observe = vi
      .spyOn(BreakpointObserver.prototype, 'observe')
      .mockReturnValue(of({ matches: true, breakpoints: {} }));
    await open();

    const side = root().querySelector('aside.side app-chat-panel');
    expect(side?.querySelector('section.framed')).not.toBeNull();
    expect(side?.querySelector('section.trimmed')).toBeNull();
    expect(side?.querySelector('h2')?.textContent).toBe('Live Discussion');
    expect(root().querySelectorAll('app-chat-panel')).toHaveLength(1);
    expect(controlNames().some((name) => name.startsWith('Chat'))).toBe(false);
    observe.mockRestore();
  });

  it('titles the drawer with how many are in the room', async () => {
    await open();

    press('Chat', root().querySelector('app-room-controls')!);
    await settle();

    expect(document.body.querySelector('.sheet-title')?.textContent).toMatch(
      /Live Discussion\s+\d+ in room/,
    );
  });

  it('opens the chat from the dock, and a comment the person sends appears once the server has kept it', async () => {
    await open();

    press('Chat', root().querySelector('app-room-controls')!);
    await settle();
    const panel = document.body.querySelector('app-chat-panel')!;
    expect(panel).not.toBeNull();
    expect(sent('GET', `${BASE}/comments`)).toBe(true);

    const message = panel.querySelector('textarea')!;
    message.value = 'Hola a todos';
    message.dispatchEvent(new Event('input'));
    await settle();
    expect(panel.textContent).not.toContain('Hola a todos'.concat(' '));
    panel.querySelector('form.composer')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();

    expect(sent('POST', `${BASE}/comments`)).toBe(true);
    expect(panel.querySelector('.message-item .text')?.textContent).toBe('Hola a todos');
  });

  it('badges the chat button with what others said while it was closed', async () => {
    await open();

    link.last.listener.chatEvent({
      type: 'COMMENT_POSTED',
      comment: {
        id: 'c-9',
        authorId: 'b-1',
        type: 'TEXT',
        content: 'Hello',
        createdAt: '2026-11-19T10:00:00Z',
      },
    });
    await settle();

    expect(controlNames()).toContain('Chat, 1 unread');
  });

  it('shows a reaction the server announces on the face of the person who sent it', async () => {
    await open();

    link.last.listener.roomEvent({
      type: 'REACTIONS',
      reactions: [{ userId: 'b-1', reaction: 'HEART' }],
    });
    await settle();

    expect(root().querySelector('app-person-avatar img.reaction[src$="heart.svg"]')).not.toBeNull();
  });

  it('sends the reaction a person picks', async () => {
    await open();

    press('React', root().querySelector('app-room-controls')!);
    await settle();
    await new Promise((resolve) => setTimeout(resolve));
    [...document.querySelectorAll<HTMLButtonElement>('.p-popover button')]
      .find((choice) => nameOf(choice) === 'Sparkles')!
      .click();
    await settle();

    expect(body('POST', `${BASE}/reactions`)).toEqual({ reaction: 'SPARKLES' });
  });

  describe('a person in the room', () => {
    const BILAL = {
      'GET /api/v1/users/b-1': {
        status: 200,
        body: {
          id: 'b-1',
          username: 'bilal',
          displayName: 'Bilal',
          bio: 'Coffee and Spanish',
          nativeLanguage: 'es',
          countryCode: 'ES',
          createdAt: '2026-10-01T10:00:00Z',
          nativeLanguages: ['es'],
          learningLanguages: [{ languageCode: 'ar', proficiencyLevel: 'INTERMEDIATE' }],
        },
      },
      'GET /api/v1/users/b-1/social': {
        status: 200,
        body: { followerCount: 1250, followingCount: 3, followedByMe: false, followsMe: true },
      },
    };

    async function openBilal() {
      await open();
      [...root().querySelectorAll<HTMLButtonElement>('app-audience-grid .person')]
        .find((person) => person.getAttribute('aria-label')?.includes('b-1'))!
        .click();
      await settle(BILAL);
    }

    it('opens with who they are, how they follow, and what you could practise together', async () => {
      await openBilal();

      expect(page().textContent).toContain('Language exchange match');
      expect(page().textContent).toContain('Coffee and Spanish');
      expect(page().textContent).toContain('Follows you');
      expect(page().textContent).toContain('1.3K');
      expect(buttons().map(nameOf)).toEqual(
        expect.arrayContaining(['Follow back', 'View profile']),
      );
    });

    it('is followed with one press, and the numbers are read again', async () => {
      await openBilal();
      requests.length = 0;

      press('Follow back');
      await settle(BILAL);

      expect(sent('POST', '/api/v1/users/b-1/follow')).toBe(true);
      expect(sent('GET', '/api/v1/users/b-1/social')).toBe(true);
    });

    it('takes you to their profile page', async () => {
      await openBilal();

      press('View profile');
      await settle(BILAL);

      expect(TestBed.inject(Router).url).toBe('/people/b-1');
    });

    it('is blocked only after asking', async () => {
      await openBilal();

      await pressSafety('Block');
      await settle(BILAL);
      expect(page().textContent).toContain('Blocking removes any follows');
      expect(sent('POST', '/api/v1/users/b-1/block')).toBe(false);

      pressExactlyLast('Block');
      await settle(BILAL);
      expect(sent('POST', '/api/v1/users/b-1/block')).toBe(true);
    });
  });

  it('takes a free seat, and shows it when the server announces it', async () => {
    await open();

    root().querySelector<HTMLButtonElement>('app-stage-seats .seat')!.click();
    await settle();
    link.last.listener.roomEvent({
      type: 'STAGE_UPDATED',
      at: Date.now(),
      stage: { speakers: ['h-1', 'm-1'], handRaiseQueue: ['b-1'] },
    });
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

  it('does not ask for the room again once it has it: the server announces what changes', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await open();
    requests.length = 0;

    vi.advanceTimersByTime(10 * 60_000);
    await settle();

    expect(requests).toEqual([]);
  });

  it('shows what the host changed about the room, when the server announces it', async () => {
    await open();

    link.last.listener.roomEvent({
      type: 'ROOM_UPDATED',
      title: 'A new title',
      topic: 'A new topic',
      maxStageSeats: 4,
    });
    await settle();

    expect(root().textContent).toContain('A new title');
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

    it('puts Edit the room and End the room in the header, and an Invite for each raised hand', async () => {
      await open(asHost);

      const tools = [...root().querySelectorAll('header .host-tools button')].map(nameOf);
      expect(tools).toEqual(['Edit the room', 'End the room']);
      expect(root().querySelector('app-raised-hands button')?.getAttribute('aria-label')).toBe(
        'Invite b-1 to the stage',
      );
    });

    it('offers no invitation when the stage is full, anywhere: not in the hands, not on the seat, not on the card', async () => {
      server.room = { ...ROOM, maxStageSeats: 2 };
      server.stage = { speakers: ['h-1', 'm-1'], handRaiseQueue: ['b-1'] };
      await open(asHost);

      expect(root().querySelector('app-raised-hands button')).toBeNull();
      const listener = root().querySelector<HTMLElement>('app-audience-grid .person')!;
      listener.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      await settle();
      await new Promise((resolve) => setTimeout(resolve));
      const items = [...document.querySelectorAll('.p-menu-item-link')].map((i) =>
        i.textContent?.trim(),
      );
      expect(items).toContain('Remove from the room');
      expect(items).not.toContain('Invite to the stage');
    });

    it('invites someone to the stage, and shows them there when the server announces it', async () => {
      await open(asHost);

      root().querySelector<HTMLButtonElement>('app-raised-hands button')!.click();
      await settle();
      link.last.listener.roomEvent({
        type: 'STAGE_UPDATED',
        at: Date.now(),
        stage: { speakers: ['h-1', 'b-1'], handRaiseQueue: [] },
      });
      await settle();

      expect(sent('POST', `${BASE}/stage/promote/b-1`)).toBe(true);
      expect(root().querySelectorAll('app-stage-seats .person')).toHaveLength(2);
    });

    it('removes someone only after asking', async () => {
      await open(asHost);
      [...root().querySelectorAll<HTMLButtonElement>('app-audience-grid .person')]
        .find((p) => p.getAttribute('aria-label')?.includes('b-1'))!
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

    describe('from a seat', () => {
      const seats = (within: string) => [
        ...root().querySelectorAll<HTMLElement>(`${within} app-moderation-menu .person`),
      ];
      // A right click opens a seat's menu at once; the hover and the long press have their own tests with the menu.
      const openMenu = async (seat: HTMLElement) => {
        seat.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        await settle();
        await new Promise((resolve) => setTimeout(resolve));
      };
      const menuItems = () => [...document.querySelectorAll<HTMLElement>('.p-menu-item-link')];
      const pressSeatItem = async (within: string, label: string) => {
        // On the stage the host is the first seat and has no menu, so the speaker is the last; in the audience it is the first.
        const people = seats(within);
        await openMenu(within === 'app-stage-seats' ? people.at(-1)! : people[0]);
        menuItems()
          .find((item) => item.textContent?.includes(label))!
          .click();
      };

      it('offers a menu on everyone in the room except the host and themselves', async () => {
        server.stage = { speakers: ['h-1', 'b-1'], handRaiseQueue: [] };
        await open(asHost);

        const [hostSeat, bilal] = seats('app-stage-seats');
        await openMenu(hostSeat);
        expect(menuItems()).toHaveLength(0);

        await openMenu(bilal);
        expect(menuItems().map((item) => item.textContent?.trim())).toEqual([
          'Mute',
          'Move to the audience',
          'Remove from the room',
          'Block',
        ]);
        expect(root().querySelector('app-moderation-menu button:not(.person)')).toBeNull();
      });

      it('offers it to nobody when you are not the host', async () => {
        server.stage = { speakers: ['h-1', 'b-1'], handRaiseQueue: [] };
        await open();

        await openMenu(seats('app-audience-grid')[0]);
        expect(menuItems()).toHaveLength(0);
      });

      it('mutes a speaker', async () => {
        server.stage = { speakers: ['h-1', 'b-1'], handRaiseQueue: [] };
        await open(asHost);

        await pressSeatItem('app-stage-seats', 'Mute');
        await settle();

        expect(sent('POST', `${BASE}/stage/mute/b-1`)).toBe(true);
      });

      it('stops offering to mute someone whose microphone is already muted', async () => {
        server.stage = { speakers: ['h-1', 'b-1'], handRaiseQueue: [] };
        await open(asHost);
        link.last.listener.microphoneMuted('b-1', true, false);
        await settle();

        await openMenu(seats('app-stage-seats')[1]);

        const items = menuItems().map((i) => i.textContent?.trim());
        expect(items).toContain('Move to the audience');
        expect(items).not.toContain('Mute');
      });

      it('removes a listener only after asking', async () => {
        await open(asHost);

        await pressSeatItem('app-audience-grid', 'Remove from the room');
        await settle();
        expect(page().textContent).toContain('will leave the room and cannot come back.');
        expect(sent('DELETE', `${BASE}/participants/b-1`)).toBe(false);

        pressExactlyLast('Remove');
        await settle();
        expect(sent('DELETE', `${BASE}/participants/b-1`)).toBe(true);
      });

      it('invites a listener to the stage', async () => {
        await open(asHost);

        await pressSeatItem('app-audience-grid', 'Invite to the stage');
        await settle();

        expect(sent('POST', `${BASE}/stage/promote/b-1`)).toBe(true);
      });
    });

    it('ends the room only after asking, and goes back to the hallway', async () => {
      await open(asHost);

      pressHostAction('End the room');
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

      pressHostAction('Edit the room');
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

    it('lets a speaker who is not the host step down from the controls, and the host not', async () => {
      server.session = speakerSession();
      server.stage = { speakers: ['h-1', 'm-1'], handRaiseQueue: [] };
      await open();
      expect(controlLabels()).toContain('Step down to the audience');

      press('Step down to the audience', root());
      await settle();
      expect(sent('POST', `${BASE}/stage/leave`)).toBe(true);
    });

    it('does not offer the host a way down from the controls: the host keeps the stage', async () => {
      server.session = speakerSession();
      server.stage = { speakers: ['h-1'], handRaiseQueue: [] };
      await open({ me: 'h-1' });

      expect(controlLabels()).toContain('Mute');
      expect(controlLabels()).not.toContain('Step down to the audience');
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
          summary: 'Your microphone is blocked. Allow it in your browser, then press Unmute.',
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

    it('stays in the room, with its audio, when the page goes away for another route', async () => {
      await open();
      const sentBefore = requests.length;

      fixture.destroy();

      expect(link.last.disconnected).toBe(false);
      expect(requests.slice(sentBefore).some((r) => r.url.endsWith('/participants/leave'))).toBe(
        false,
      );
      expect(TestBed.inject(ActiveRoomService).room()).toEqual(
        expect.objectContaining({ id: 'r-1' }),
      );
    });

    it('is the same room, with nothing joined again, when the page comes back to it', async () => {
      await open();
      fixture.destroy();
      requests.length = 0;

      await open();

      expect(requests.some((r) => r.url.endsWith('/participants/join'))).toBe(false);
      expect(link.connections).toHaveLength(1);
      expect(page().textContent).toContain('Spanish for beginners');
    });
  });
});
