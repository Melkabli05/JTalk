import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { openFeed, ROOMS_URL } from './room-feed-testing';
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

  it('loads the open rooms as app models', () => {
    let rooms: string[] = [];

    api.rooms().subscribe((list) => (rooms = list.map((r) => r.title)));
    http.expectOne(ROOMS_URL).flush({ content: [room] });

    expect(rooms).toEqual(['Spanish']);
  });

  it('turns a response of the wrong shape into an error instead of bad data', () => {
    const failed = vi.fn();

    api.rooms().subscribe({ error: failed });
    http.expectOne(ROOMS_URL).flush({ content: [{ ...room, hostId: 5 }] });

    expect(failed).toHaveBeenCalledOnce();
  });

  it('streams what happens to the rooms, and skips what it does not know', () => {
    const heard: string[] = [];

    const subscription = api.feed().subscribe((event) => heard.push(event.type));
    const feed = openFeed(http);
    feed.say(
      { type: 'READY' },
      { type: 'SOMETHING_NEW' },
      { type: 'ROOM_OPENED', room },
      { type: 'ROOM_CLOSED', roomId: 'r-1' },
    );

    expect(heard).toEqual(['READY', 'ROOM_OPENED', 'ROOM_CLOSED']);
    subscription.unsubscribe();
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
