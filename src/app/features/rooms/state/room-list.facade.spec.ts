import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { fakeIdentity } from '@core/auth/auth-testing';
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

describe('RoomListFacade', () => {
  let http: HttpTestingController;
  let facade: RoomListFacade;

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
});
