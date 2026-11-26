import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '@auth0/auth0-angular';
import { from } from 'rxjs';
import { vi } from 'vitest';
import { CreateVoiceRoomPayload } from '../../shared/models/voice-room.model';
import { LiveRoomStore } from '../../features/room/store/live-room-store';
import { ROOM_ROUTES } from '../../features/room/room.routes';
import { RoomLauncher } from './room-launcher';
import { ToastNotifier } from './toast-notifier';

describe('RoomLauncher', () => {
  const toastSpy = { show: vi.fn() };
  let returnedConfig: CreateVoiceRoomPayload | undefined;
  const dialogSpy = {
    getDialogById: vi.fn(() => undefined),
    open: vi.fn(() => ({ afterClosed: () => from([returnedConfig]) })),
  };

  beforeEach(() => {
    returnedConfig = undefined;
    toastSpy.show.mockReset();
    dialogSpy.open.mockClear();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'room', children: ROOM_ROUTES }], withComponentInputBinding()),
        {
          provide: AuthService,
          useValue: {
            isLoading$: from([false]),
            isAuthenticated$: from([true]),
            user$: from([{ 'https://jtalk.app/user_id': 'u-host', name: 'Amina' }]),
            error$: from([null]),
            getAccessTokenSilently: () => from(['tok']),
            loginWithRedirect: vi.fn(),
            logout: () => from([undefined]),
          },
        },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: ToastNotifier, useValue: toastSpy },
      ],
    });
  });

  afterEach(() => TestBed.inject(LiveRoomStore).rememberRoom(null));

  it('should not open room or navigate when dialog is dismissed', async () => {
    const launcher = TestBed.inject(RoomLauncher);
    const roomStore = TestBed.inject(LiveRoomStore);
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    launcher.openStartRoom();

    await vi.waitFor(() => expect(dialogSpy.open).toHaveBeenCalledTimes(1));
    expect(roomStore.resumeRoomId()).toBeNull();
    expect(navSpy).not.toHaveBeenCalled();
    expect(toastSpy.show).not.toHaveBeenCalled();
  });

  it('creates a room and registers the host as present before requesting chat', async () => {
    returnedConfig = {
      title: 'Morning Coffee',
      topic: 'Pronunciation',
      targetLanguage: 'fr',
      nativeLanguage: 'en',
      maxStageSeats: 6,
    };

    const launcher = TestBed.inject(RoomLauncher);
    const router = TestBed.inject(Router);
    const httpMock = TestBed.inject(HttpTestingController);
    const roomStore = TestBed.inject(LiveRoomStore);
    const connect = vi.spyOn(roomStore.audio, 'connect').mockResolvedValue(true);
    const harness = await RouterTestingHarness.create();

    launcher.openStartRoom();

    const req = await vi.waitFor(() => httpMock.expectOne('/api/v1/voice-rooms'));
    launcher.openStartRoom();
    expect(dialogSpy.open).toHaveBeenCalledOnce();
    httpMock.expectNone('/api/v1/voice-rooms');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      title: 'Morning Coffee',
      topic: 'Pronunciation',
      targetLanguage: 'fr',
      nativeLanguage: 'en',
      maxStageSeats: 6,
    });

    const created = {
      room: {
        id: 'room-abc-123',
        title: 'Morning Coffee',
        topic: 'Pronunciation',
        hostId: 'u-host',
        targetLanguage: 'fr',
        nativeLanguage: 'en',
        maxStageSeats: 6,
        speakers: ['u-host'],
        participantCount: 0,
        handRaiseCount: 0,
      },
      liveKitUrl: 'wss://example.invalid',
      liveKitToken: 'create-token',
      role: 'HOST',
      canPublishAudio: true,
    };
    req.flush(created);

    const base = '/api/v1/voice-rooms/room-abc-123';
    const join = await vi.waitFor(
      () => {
        harness.detectChanges();
        return httpMock.expectOne({ url: `${base}/participants/join`, method: 'POST' });
      },
      { timeout: 3000 },
    );
    httpMock.expectNone(`${base}/participants/snapshot`);
    expect(connect).not.toHaveBeenCalled();
    const joinedRoom = { ...created.room, participantCount: 1 };
    join.flush({ ...created, room: joinedRoom, liveKitToken: 'join-token' });

    const snap = await vi.waitFor(() => {
      harness.detectChanges();
      return httpMock.expectOne(`${base}/participants/snapshot`);
    });
    snap.flush({
      room: joinedRoom,
      role: 'HOST',
      snapshot: {
        speakers: [{ userId: 'u-host', displayName: 'Amina', isReconnecting: false }],
        audienceCount: 0,
        audience: { audiencePreview: [], nextCursor: null, hasMoreAudience: false },
        handRaiseQueue: [],
        chat: { comments: [], topic: null, muted: false, mutedUsers: [], reactions: [] },
      },
    });
    expect(connect).toHaveBeenCalledWith(expect.objectContaining({ liveKitToken: 'join-token' }));
    expect(roomStore.resumeRoomId()).toBe(joinedRoom.id);
    expect(router.url).toBe('/room/room-abc-123');
    expect(toastSpy.show).toHaveBeenCalledWith('Room open.');
  });
});
