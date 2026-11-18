import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FEED_URL, openFeed } from './room-feed-testing';
import { RoomsApiService } from './rooms-api.service';

const room = {
  id: 'r-1',
  title: 'Spanish',
  topic: 'Food',
  hostId: 'h-1',
  targetLanguage: 'es',
  nativeLanguage: 'en',
  maxStageSeats: 6,
  createdAt: '2026-11-14T10:00:00Z',
  speakers: ['h-1'],
  participantCount: 1,
  handRaiseCount: 0,
};

describe('RoomsApiService', () => {
  let http: HttpTestingController;
  let api: RoomsApiService;
  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(RoomsApiService);
  });
  afterEach(() => http.verify());

  describe('the feed', () => {
    afterEach(() => vi.useRealTimers());

    it('streams the open rooms and what happens to them, and skips what it does not know', () => {
      const heard: string[] = [];

      const subscription = api.feed().subscribe((event) => heard.push(event.type));
      openFeed(http).say(
        { type: 'SNAPSHOT', rooms: [room] },
        { type: 'SOMETHING_NEW' },
        { type: 'ROOM_OPENED', room: { ...room, id: 'r-2' } },
        { type: 'ROOM_CLOSED', roomId: 'r-1' },
      );

      expect(heard).toEqual(['SNAPSHOT', 'ROOM_OPENED', 'ROOM_CLOSED']);
      subscription.unsubscribe();
    });

    it('reopens a connection the server ended, and the list starts again', () => {
      vi.useFakeTimers();
      const heard: string[] = [];
      const subscription = api.feed().subscribe((event) => heard.push(event.type));
      const first = openFeed(http);
      first.say({ type: 'SNAPSHOT', rooms: [] });
      first.end();

      vi.advanceTimersByTime(1000);
      openFeed(http).say({ type: 'SNAPSHOT', rooms: [room] });

      expect(heard).toEqual(['SNAPSHOT', 'SNAPSHOT']);
      subscription.unsubscribe();
    });

    it('retries a connection that fails, with a growing pause, and then gives up', () => {
      vi.useFakeTimers();
      const failed = vi.fn();
      api.feed().subscribe({ error: failed });

      openFeed(http).fail();
      vi.advanceTimersByTime(999);
      http.expectNone(FEED_URL);
      vi.advanceTimersByTime(1);
      openFeed(http).fail();
      vi.advanceTimersByTime(1999);
      http.expectNone(FEED_URL);
      vi.advanceTimersByTime(1);
      openFeed(http).fail();
      expect(failed).not.toHaveBeenCalled();

      vi.advanceTimersByTime(4000);
      openFeed(http).fail();
      vi.advanceTimersByTime(8000);
      openFeed(http).fail();
      vi.advanceTimersByTime(16_000);
      openFeed(http).fail();

      expect(failed).toHaveBeenCalledOnce();
      vi.advanceTimersByTime(60_000);
      http.expectNone(FEED_URL);
    });
  });

  it('refetches one room when the id changes', async () => {
    const id = signal('r-1');
    const one = TestBed.runInInjectionContext(() => api.roomResource(id));
    TestBed.tick();
    http.expectOne('/api/v1/voice-rooms/r-1').flush(room);
    await settle();
    expect(one.value()?.id).toBe('r-1');

    id.set('r-2');
    TestBed.tick();
    http.expectOne('/api/v1/voice-rooms/r-2').flush({ ...room, id: 'r-2' });
    await settle();
    expect(one.value()?.id).toBe('r-2');
  });

  it('opens a room and returns the session', () => {
    const draft = {
      title: 'T',
      topic: '',
      targetLanguage: 'es',
      nativeLanguage: 'en',
      maxStageSeats: 4,
    };
    let opened: string | undefined;

    api.create(draft).subscribe((session) => (opened = session.room.id));
    const request = http.expectOne('/api/v1/voice-rooms');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(draft);
    request.flush({
      room,
      canPublishAudio: true,
      liveKitToken: 'x',
      liveKitUrl: 'wss://livekit.test',
    });

    expect(opened).toBe('r-1');
  });

  it('updates and closes a room', () => {
    api.update('r-1', { title: 'New', topic: 'T', maxStageSeats: 5 }).subscribe();
    const patch = http.expectOne('/api/v1/voice-rooms/r-1');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ title: 'New', topic: 'T', maxStageSeats: 5 });
    patch.flush({ ...room, title: 'New' });

    api.close('r-1').subscribe();
    const close = http.expectOne('/api/v1/voice-rooms/r-1');
    expect(close.request.method).toBe('DELETE');
    close.flush(null, { status: 204, statusText: 'No Content' });
  });
});
