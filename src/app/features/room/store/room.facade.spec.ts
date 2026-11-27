import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { provideNoopAuthForTests } from '../../../core/auth/auth.providers';
import { ToastNotifier } from '../../../core/services/toast-notifier';
import { LIVEKIT_CONNECTOR } from '../data-access/livekit-audio-engine';
import { LiveRoomStore } from './live-room-store';
import { RoomFacade } from './room.facade';

describe('RoomFacade', () => {
  const toastSpy = { show: vi.fn() };
  const room = {
    id: 'room-1',
    hostId: 'host',
    title: 'Spanish Hour',
    topic: '',
    targetLanguage: 'es',
    nativeLanguage: 'en',
    maxStageSeats: 6,
    speakers: ['host'],
    participantCount: 1,
    handRaiseCount: 0,
  };
  const session = {
    room,
    liveKitUrl: 'wss://example.invalid',
    liveKitToken: 'tok',
    role: 'HOST' as const,
    canPublishAudio: true,
    snapshot: {
      speakers: [{ userId: 'host', displayName: 'Host', isReconnecting: false }],
      audienceCount: 0,
      audience: { audiencePreview: [], nextCursor: null, hasMoreAudience: false },
      handRaiseQueue: [],
      chat: { comments: [], topic: null, muted: false, mutedUsers: [], reactions: [] },
    },
  };

  beforeEach(() => {
    toastSpy.show.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAuthForTests(),
        { provide: ToastNotifier, useValue: toastSpy },
        {
          provide: LIVEKIT_CONNECTOR,
          useValue: async () => ({
            setMicrophone: vi.fn().mockResolvedValue(undefined),
            setNoiseIsolation: vi.fn().mockResolvedValue('krisp-active'),
            selectAudioInputDevice: vi.fn().mockResolvedValue(undefined),
            listAudioInputDevices: vi.fn().mockResolvedValue([]),
            startAudio: vi.fn().mockResolvedValue(undefined),
            disconnect: vi.fn().mockResolvedValue(undefined),
          }),
        },
      ],
    });
  });

  afterEach(() => TestBed.inject(LiveRoomStore).rememberRoom(null));

  it('joins a room, updates room settings, sends chat, and handles errors', async () => {
    const facade = TestBed.inject(RoomFacade);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    facade.enterRoom('room-1');
    http.expectOne('/api/v1/voice-rooms/room-1/participants/join').flush(session);
    await vi.waitFor(() => expect(facade.roomId()).toBe('room-1'));
    expect(facade.effectiveRoomTitle()).toBe('Spanish Hour');
    expect(facade.isHost()).toBe(true);

    facade.updateRoom('room-1', { title: 'Updated Hour', topic: 'Travel', maxStageSeats: 8 });
    const patchReq = http.expectOne({ method: 'PATCH', url: '/api/v1/voice-rooms/room-1' });
    patchReq.flush({ ...room, title: 'Updated Hour', topic: 'Travel', maxStageSeats: 8 });
    expect(facade.effectiveRoomTitle()).toBe('Updated Hour');
    expect(toastSpy.show).toHaveBeenCalledWith('Room updated.');

    let cleared = false;
    facade.sendMessage('room-1', 'Hola', () => {
      cleared = true;
    });
    expect(facade.sendingComment()).toBe(true);
    http.expectOne({ method: 'POST', url: '/api/v1/voice-rooms/room-1/comments' }).flush({
      id: 'c-1',
      type: 'TEXT',
      authorId: 'host',
      content: 'Hola',
      createdAt: '2026-01-01T00:00:00Z',
    });
    expect(facade.sendingComment()).toBe(false);
    expect(cleared).toBe(true);
    expect(facade.messages().map((m) => m.text)).toEqual(['Hola']);

    facade.endRoom('room-1');
    http.expectOne({ method: 'DELETE', url: '/api/v1/voice-rooms/room-1' }).flush(null);
    await vi.waitFor(() => expect(navSpy).toHaveBeenCalledWith(['/rooms']));
    http.verify();
  });
});
