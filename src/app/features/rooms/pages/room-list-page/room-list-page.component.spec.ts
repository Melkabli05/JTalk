import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import RoomListPageComponent, { partOfDay } from './room-list-page.component';
import { RoomStartService } from '@core/rooms/room-start.service';
import { fakeIdentity } from '@core/auth/auth-testing';
import { failUntilGivenUp, openFeed } from '../../data-access/room-feed-testing';

@Component({ selector: 'app-stub', template: '' })
class Stub {}

const roomDto = (id: string, title: string, targetLanguage: string) => ({
  id,
  title,
  topic: null,
  hostId: 'h-1',
  targetLanguage,
  nativeLanguage: 'en',
  maxStageSeats: 6,
  createdAt: '2026-11-14T10:00:00Z',
  speakers: ['h-1'],
  participantCount: 1,
  handRaiseCount: 0,
});

describe('RoomListPageComponent (container)', () => {
  let fixture: ComponentFixture<RoomListPageComponent>;
  let http: HttpTestingController;
  const root = () => fixture.nativeElement as HTMLElement;
  const titles = () =>
    [...root().querySelectorAll('app-room-card h2')].map((t) => t.textContent?.trim());
  const press = (label: string) =>
    [...document.body.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.includes(label))!
      .click();

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        fakeIdentity({ id: 'm-1', name: 'Mona', nativeLanguage: 'ar', learning: 'es', avatar: '' })
          .provider,
        provideRouter([{ path: 'rooms/:id', component: Stub }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function render(answer: () => void) {
    fixture = TestBed.createComponent(RoomListPageComponent);
    fixture.detectChanges();
    answer();
    await fixture.whenStable();
  }
  const withRooms =
    (...rooms: object[]) =>
    () => {
      openFeed(http).say({ type: 'SNAPSHOT', rooms });
    };

  it('shows a card for each open room', async () => {
    await render(withRooms(roomDto('r-1', 'Spanish', 'es'), roomDto('r-2', 'French', 'fr')));

    expect(titles()).toEqual(['Spanish', 'French']);
  });

  it('says so, and offers to start one, when there are no rooms', async () => {
    await render(withRooms());

    expect(root().textContent).toContain('Quiet right now');
    expect(root().querySelector('app-room-card')).toBeNull();
  });

  it('shows placeholders shaped like the cards, announced as finding rooms, while the rooms load', async () => {
    fixture = TestBed.createComponent(RoomListPageComponent);
    fixture.detectChanges();

    expect(root().querySelectorAll('.rooms li')).toHaveLength(3);
    expect(root().querySelectorAll('.rooms p-card')).toHaveLength(3);
    expect(root().querySelector('[role="status"]')?.textContent).toContain('Finding open rooms');
    openFeed(http).say({ type: 'SNAPSHOT', rooms: [] });
    await fixture.whenStable();
  });

  it('tells screen readers how many rooms are shown, and updates it when the filter changes', async () => {
    await render(withRooms(roomDto('r-1', 'Spanish', 'es'), roomDto('r-2', 'French', 'fr')));
    const status = () => root().querySelector('[role="status"]')?.textContent?.trim();
    expect(status()).toBe('Rooms shown: 2');

    [...root().querySelectorAll<HTMLElement>('app-language-filter [role="button"]')]
      .find((o) => o.textContent?.includes('French'))!
      .click();
    await fixture.whenStable();

    expect(status()).toBe('Rooms shown: 1');
  });

  it('greets the person by first name, at the hour of the day', async () => {
    await render(withRooms(roomDto('r-1', 'Spanish', 'es')));

    expect(root().querySelector('h1')?.textContent?.trim()).toMatch(
      /^Good (morning|afternoon|evening), Mona$/,
    );
  });

  it('lists every open room under one heading, Active rooms', async () => {
    await render(
      withRooms(
        roomDto('a', 'A', 'es'),
        roomDto('b', 'B', 'es'),
        roomDto('c', 'C', 'fr'),
        roomDto('d', 'D', 'fr'),
        roomDto('e', 'E', 'ja'),
      ),
    );

    expect(root().querySelectorAll('section.group')).toHaveLength(1);
    expect(root().querySelector('section.group h2')?.textContent?.trim()).toBe('Active rooms');
    expect(titles()).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('opens the form when the sidebar asks to start a room, even if it asked first', async () => {
    TestBed.inject(RoomStartService).request();
    await render(withRooms());

    expect(TestBed.inject(RoomStartService).requested()).toBe(false);
    expect(document.body.querySelector('p-dialog, .p-dialog')).not.toBeNull();
  });

  it('gives each card a real heading under the page title', async () => {
    await render(withRooms(roomDto('r-1', 'Spanish', 'es')));

    expect(root().querySelectorAll('h1')).toHaveLength(1);
    expect(root().querySelector('app-room-card h2')?.textContent?.trim()).toBe('Spanish');
  });

  it('points to the one Start a room button instead of repeating it in the empty state', async () => {
    await render(withRooms());

    expect(root().querySelector('.empty button')).toBeNull();
    expect(root().querySelector('.hero button.start')?.textContent).toContain('Start a room');
  });

  it('lets the person try again when the rooms could not be loaded', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await render(() => failUntilGivenUp(http));

    [...root().querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.includes('Try again'))!
      .click();
    fixture.detectChanges();
    withRooms(roomDto('r-1', 'Spanish', 'es'))();
    await fixture.whenStable();

    expect(titles()).toEqual(['Spanish']);
  });

  it('says so when the rooms cannot be loaded', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await render(() => failUntilGivenUp(http));

    expect(root().textContent).toContain('Could not load the rooms.');
  });

  it('adds a room the moment it opens, and drops it the moment it closes, without asking again', async () => {
    let feed!: ReturnType<typeof openFeed>;
    await render(() => {
      feed = openFeed(http);
      feed.say({ type: 'SNAPSHOT', rooms: [roomDto('r-1', 'Spanish', 'es')] });
    });

    feed.say({ type: 'ROOM_OPENED', room: roomDto('r-2', 'French', 'fr') });
    await fixture.whenStable();
    expect(titles()).toEqual(['French', 'Spanish']);

    feed.say({ type: 'ROOM_CLOSED', roomId: 'r-1' });
    await fixture.whenStable();
    expect(titles()).toEqual(['French']);
    http.verify();
  });

  it('filters the rooms by language, when more than one is practised', async () => {
    await render(withRooms(roomDto('r-1', 'Spanish', 'es'), roomDto('r-2', 'French', 'fr')));

    [...root().querySelectorAll<HTMLElement>('app-language-filter [role="button"]')]
      .find((o) => o.textContent?.includes('French'))!
      .click();
    await fixture.whenStable();

    expect(titles()).toEqual(['French']);
  });

  it('offers no language filter when every room practises the same language', async () => {
    await render(withRooms(roomDto('r-1', 'Spanish', 'es'), roomDto('r-2', 'More Spanish', 'es')));

    expect(root().querySelector('app-language-filter')).toBeNull();
  });

  it('opens a room from its card', async () => {
    await render(withRooms(roomDto('r-1', 'Spanish', 'es')));

    root().querySelector<HTMLButtonElement>('app-room-card button')!.click();
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/rooms/r-1');
  });

  describe('starting a room', () => {
    async function openDialog() {
      await render(withRooms());
      press('Start a room');
      await fixture.whenStable();
    }
    const field = (label: string) =>
      [...document.body.querySelectorAll('app-text-field')]
        .find((f) => f.querySelector('label')?.textContent === label)!
        .querySelector('input')!;

    it('fills the form in for the person: a title and topic, and their own languages', async () => {
      await openDialog();

      expect(field('Title').value).toBe('Practice room');
      expect(field('Topic').value).toBe('Just chatting');
      const choices = [...document.body.querySelectorAll('app-room-form app-select-field')].map(
        (s) => s.textContent?.replace(/\s+/g, ' '),
      );
      expect(choices[0]).toContain('Spanish');
      expect(choices[1]).toContain('Arabic');
    });

    it('opens the room and goes into it', async () => {
      await openDialog();

      document.body
        .querySelector('app-room-form form')!
        .dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();
      const request = http.expectOne({ method: 'POST', url: '/api/v1/voice-rooms' });
      expect(request.request.body).toEqual({
        title: 'Practice room',
        topic: 'Just chatting',
        targetLanguage: 'es',
        nativeLanguage: 'ar',
        maxStageSeats: 6,
      });
      request.flush({
        room: roomDto('r-new', 'Practice room', 'es'),
        role: 'HOST',
        canPublishAudio: true,
        liveKitToken: 'x',
        liveKitUrl: 'wss://livekit.test',
      });
      await fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/rooms/r-new');
    });

    it('stays on the form with a message when the room could not be opened', async () => {
      await openDialog();

      document.body
        .querySelector('app-room-form form')!
        .dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();
      http
        .expectOne({ method: 'POST', url: '/api/v1/voice-rooms' })
        .flush('no', { status: 502, statusText: 'Bad Gateway' });
      await fixture.whenStable();

      expect(document.body.textContent).toContain('Could not open the room.');
      expect(TestBed.inject(Router).url).toBe('/');
    });
  });
});

describe('partOfDay', () => {
  it('splits the day at noon and at six in the evening', () => {
    expect([0, 5, 11].map(partOfDay)).toEqual(['morning', 'morning', 'morning']);
    expect([12, 17].map(partOfDay)).toEqual(['afternoon', 'afternoon']);
    expect([18, 23].map(partOfDay)).toEqual(['evening', 'evening']);
  });
});
