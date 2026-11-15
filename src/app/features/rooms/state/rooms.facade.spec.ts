import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { RoomDraft } from '../models/room.model';
import { provideRooms, RoomsFacade } from './rooms.facade';

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

describe('RoomsFacade', () => {
  let http: HttpTestingController;
  let facade: RoomsFacade;
  const list = () => http.match((request) => request.method === 'GET');

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRooms()],
    });
    http = TestBed.inject(HttpTestingController);
    facade = TestBed.inject(RoomsFacade);
    TestBed.tick();
  });
  afterEach(() => vi.useRealTimers());

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

  it('keeps the list fresh every few seconds', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRooms()],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(RoomsFacade);
    TestBed.tick();
    list().forEach((request) => request.flush({ content: [] }));
    await Promise.resolve();
    TestBed.tick();

    vi.advanceTimersByTime(5000);
    await Promise.resolve();
    TestBed.tick();

    expect(list()).toHaveLength(1);
  });
});
