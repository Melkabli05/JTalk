import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { fakeIdentity } from '@core/auth/auth-testing';
import { FEED_URL, openFeed, ROOMS_URL } from '../data-access/room-feed-testing';
import type { RoomDraft } from '../models/room.model';
import { provideRoomList, RoomListFacade } from './room-list.facade';

const DRAFT: RoomDraft = {
  title: 'T',
  topic: 'p',
  targetLanguage: 'es',
  nativeLanguage: 'en',
  maxStageSeats: 4,
};
const ROOM = {
  id: 'r-9',
  title: 'T',
  topic: 'p',
  hostId: 'h',
  targetLanguage: 'es',
  nativeLanguage: 'en',
  maxStageSeats: 4,
  createdAt: '2026-11-14T10:00:00Z',
  speakers: ['h'],
  participantCount: 1,
  handRaiseCount: 0,
};

function show(state: 'visible' | 'hidden'): void {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('RoomListFacade', () => {
  let http: HttpTestingController;
  let facade: RoomListFacade;
  const titles = () => facade.state.rooms()?.map((room) => room.title);

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        fakeIdentity({ id: 'm-1', name: 'Me', nativeLanguage: 'ar', learning: 'es', avatar: '' })
          .provider,
        provideRoomList(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    facade = TestBed.inject(RoomListFacade);
    TestBed.tick();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts a room, and gives the new room to the page', () => {
    const opened = vi.fn();

    facade.start(DRAFT, opened);
    const request = http.expectOne({ method: 'POST', url: '/api/v1/voice-rooms' });
    expect(request.request.body).toEqual(DRAFT);
    expect(facade.opening.submitting()).toBe(true);
    request.flush({
      room: ROOM,
      canPublishAudio: true,
      liveKitToken: 'x',
      liveKitUrl: 'wss://livekit.test',
    });

    expect(opened).toHaveBeenCalledExactlyOnceWith('r-9');
    expect(facade.opening.submitting()).toBe(false);
  });

  it('says so, and does not move on, when the room cannot be opened', () => {
    const opened = vi.fn();

    facade.start(DRAFT, opened);
    http
      .expectOne({ method: 'POST', url: '/api/v1/voice-rooms' })
      .flush('error', { status: 500, statusText: 'Error' });

    expect(facade.opening.error()).toBe('Could not open the room. Please try again.');
    expect(opened).not.toHaveBeenCalled();
  });

  it('loads the list once the server says READY, and then only listens', () => {
    const feed = openFeed(http);
    expect(facade.state.rooms()).toBeUndefined();

    feed.say({ type: 'READY' });
    http.expectOne(ROOMS_URL).flush({ content: [{ ...ROOM, title: 'First' }] });
    expect(titles()).toEqual(['First']);

    feed.say({ type: 'ROOM_OPENED', room: { ...ROOM, id: 'r-10', title: 'Second' } });
    expect(titles()).toEqual(['Second', 'First']);
    feed.say({ type: 'ROOM_CLOSED', roomId: 'r-9' });
    expect(titles()).toEqual(['Second']);
    http.verify(); // no further requests: nothing polls
  });

  it('applies what arrived while the list was loading after the list, in order', () => {
    const feed = openFeed(http);
    feed.say({ type: 'READY' });
    const listRequest = http.expectOne(ROOMS_URL);

    feed.say(
      { type: 'ROOM_OPENED', room: { ...ROOM, id: 'r-10', title: 'Opened meanwhile' } },
      { type: 'ROOM_CLOSED', roomId: 'r-9' },
    );
    expect(facade.state.rooms()).toBeUndefined();
    listRequest.flush({ content: [{ ...ROOM, title: 'First' }] });

    expect(titles()).toEqual(['Opened meanwhile']);
  });

  it('says it failed when the server cannot be reached, then reconnects and loads the list again', () => {
    vi.useFakeTimers();
    openFeed(http).fail();
    expect(facade.state.failed()).toBe(true);

    vi.advanceTimersByTime(1000);
    const feed = openFeed(http);
    feed.say({ type: 'READY' });
    http.expectOne(ROOMS_URL).flush({ content: [ROOM] });

    expect(facade.state.failed()).toBe(false);
    expect(titles()).toEqual(['T']);
  });

  it('reconnects when the server ends the stream', () => {
    vi.useFakeTimers();
    const feed = openFeed(http);
    feed.say({ type: 'READY' });
    http.expectOne(ROOMS_URL).flush({ content: [ROOM] });

    feed.end();
    vi.advanceTimersByTime(1000);

    openFeed(http).say({ type: 'READY' });
    http.expectOne(ROOMS_URL).flush({ content: [{ ...ROOM, title: 'After' }] });
    expect(titles()).toEqual(['After']);
  });

  it('waits longer after each failed attempt', () => {
    vi.useFakeTimers();
    openFeed(http).fail();
    vi.advanceTimersByTime(1000);
    openFeed(http).fail();

    vi.advanceTimersByTime(1999);
    http.expectNone(FEED_URL);
    vi.advanceTimersByTime(1);
    http.expectOne(FEED_URL);
  });

  it('reconnects at once when asked to', () => {
    openFeed(http).fail();

    facade.reconnect();

    http.expectOne(FEED_URL);
  });

  it('closes the connection while the page is hidden, and loads the list again when it is shown', () => {
    const feed = openFeed(http);
    feed.say({ type: 'READY' });
    http.expectOne(ROOMS_URL).flush({ content: [ROOM] });

    show('hidden');
    http.expectNone(FEED_URL);
    show('visible');

    const again = openFeed(http);
    again.say({ type: 'READY' });
    http.expectOne(ROOMS_URL).flush({ content: [{ ...ROOM, title: 'Back' }] });
    expect(titles()).toEqual(['Back']);
  });
});
