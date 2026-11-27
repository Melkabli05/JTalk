import { httpErrorInterceptor } from '../../../../core/http/http-error.interceptor';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '@auth0/auth0-angular';
import { from } from 'rxjs';
import { vi } from 'vitest';
import { provideNoopAuthForTests } from '../../../../core/auth/auth.providers';
import { ToastNotifier } from '../../../../core/services/toast-notifier';
import type { LiveKitListener } from '../../models/livekit.model';
import { LIVEKIT_CONNECTOR } from '../../tokens/livekit-connector.token';
import { LiveRoomStore } from '../../store/live-room-store';
import { ROOM_ROUTES } from '../../room.routes';
import { RoomPage } from './room-page';

@Component({ template: 'Live rooms' })
class HallwayRoute {}

describe('RoomPage', () => {
  afterEach(() => TestBed.inject(LiveRoomStore).rememberRoom(null));
  const toastSpy = { show: vi.fn() };
  const dialogSpy = {
    open: vi.fn(),
  };

  beforeEach(async () => {
    toastSpy.show.mockReset();
    dialogSpy.open.mockClear();
    await TestBed.configureTestingModule({
      imports: [RoomPage],
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        provideNoopAuthForTests(),
        provideRouter(
          [
            { path: 'room', children: ROOM_ROUTES },
            { path: 'rooms', component: HallwayRoute },
          ],
          withComponentInputBinding(),
        ),
        LiveRoomStore,
        { provide: ToastNotifier, useValue: toastSpy },
        { provide: MatDialog, useValue: dialogSpy },
      ],
    }).compileComponents();
    TestBed.inject(LiveRoomStore).rememberRoom(null);
  });

  it('hydrates the room from join and fetches audience pages only on demand', async () => {
    const fixture = TestBed.createComponent(RoomPage);
    const store = TestBed.inject(LiveRoomStore);
    const http = TestBed.inject(HttpTestingController);
    vi.spyOn(store.audio, 'connect').mockResolvedValue(true);
    const room = {
      id: 'current',
      hostId: 'host',
      title: 'Practice',
      topic: '',
      targetLanguage: 'ar',
      nativeLanguage: 'en',
      maxStageSeats: 8,
      speakers: ['host'],
      participantCount: 1,
      handRaiseCount: 0,
    };
    const base = '/api/v1/voice-rooms/current';
    fixture.componentRef.setInput('id', room.id);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Joining room');
    expect(fixture.nativeElement.querySelector('app-room-controls')).toBeNull();

    const join = await vi.waitFor(() => http.expectOne(base + '/participants/join'));
    join.flush({
      room,
      role: 'LISTENER',
      canPublishAudio: false,
      isChatMuted: true,
      liveKitUrl: 'wss://example.invalid',
      liveKitToken: 'token',
      snapshot: {
        speakers: [{ userId: 'host', displayName: 'Cached speaker', nativeLanguage: 'en' }],
        audienceCount: 301,
        audience: {
          audiencePreview: [{ userId: 'listener', displayName: 'First listener' }],
          hasMoreAudience: true,
          nextCursor: 'listener',
        },
        handRaiseQueue: [],
        chat: {
          comments: [
            {
              id: 'comment',
              authorId: 'host',
              type: 'TEXT',
              content: 'Bundled comment',
              createdAt: '2026-01-01T00:00:00Z',
            },
          ],
          muted: true,
          topic: 'Travel',
          mutedUsers: [],
          reactions: [],
        },
      },
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const composer = fixture.nativeElement.querySelector('#composerInput') as HTMLTextAreaElement;
    expect(composer.readOnly).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Cached speaker');
    expect(fixture.nativeElement.textContent).toContain('Bundled comment');
    expect(fixture.nativeElement.textContent).toContain('301 listening');
    http.expectNone((request) => request.method === 'GET' && request.url.startsWith(base));

    for (const selector of [
      'app-room-toolbar',
      'app-room-stage',
      'app-room-audience',
      'app-room-controls',
      'app-room-discussion',
    ]) {
      expect(fixture.nativeElement.querySelector(selector)).toBeTruthy();
    }

    const audience = fixture.nativeElement.querySelector('app-room-audience') as HTMLElement;
    const more = Array.from(audience.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Show more listeners'),
    );
    expect(more).toBeDefined();
    more!.click();
    TestBed.tick();
    http.expectOne(base + '/participants/audience?cursor=listener').flush({
      audiencePreview: [{ userId: 'next', displayName: 'Next listener' }],
      hasMoreAudience: false,
      nextCursor: null,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(audience.textContent).toContain('Next listener');
    expect(audience.textContent).not.toContain('Show more listeners');
    http.verify();
  });

  async function joinForHeaderAction(role: 'HOST' | 'LISTENER') {
    const fixture = TestBed.createComponent(RoomPage);
    const store = TestBed.inject(LiveRoomStore);
    const http = TestBed.inject(HttpTestingController);
    vi.spyOn(store.audio, 'connect').mockResolvedValue(true);
    fixture.componentRef.setInput('id', 'current');
    fixture.detectChanges();
    const base = '/api/v1/voice-rooms/current';
    const join = await vi.waitFor(() => http.expectOne(base + '/participants/join'));
    join.flush({
      room: {
        id: 'current',
        title: 'Practice',
        hostId: 'host',
        targetLanguage: 'ar',
        nativeLanguage: 'en',
        maxStageSeats: 8,
        speakers: ['host'],
        participantCount: 2,
        handRaiseCount: 0,
      },
      role,
      canPublishAudio: role === 'HOST',
      liveKitUrl: 'wss://example.invalid',
      liveKitToken: 'local',
      snapshot: {
        speakers: [{ userId: 'host', displayName: 'Host' }],
        audienceCount: 1,
        audience: { audiencePreview: [], nextCursor: null, hasMoreAudience: false },
        handRaiseQueue: [],
        chat: { comments: [], muted: false, mutedUsers: [], reactions: [], topic: null },
      },
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const header = fixture.nativeElement.querySelector('app-room-toolbar') as HTMLElement;
    return { fixture, store, http, base, header };
  }

  it('closes the host room only after confirmation and keeps it open on backend failure', async () => {
    const { fixture, store, http, base, header } = await joinForHeaderAction('HOST');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const chooseEndRoom = () => {
      header.querySelector<HTMLButtonElement>('#endRoomBtn')!.click();
      fixture.detectChanges();
    };
    dialogSpy.open.mockReturnValueOnce({ afterClosed: () => from(Promise.resolve(false)) });
    chooseEndRoom();
    await Promise.resolve();
    http.expectNone({ method: 'DELETE', url: base });

    dialogSpy.open.mockReturnValue({ afterClosed: () => from(Promise.resolve(true)) });
    chooseEndRoom();
    const rejected = await vi.waitFor(() => http.expectOne({ method: 'DELETE', url: base }));
    rejected.flush({ detail: 'Host required' }, { status: 403, statusText: 'Forbidden' });
    await vi.waitFor(() => expect(toastSpy.show).toHaveBeenCalledWith('Host required'));
    expect(store.roomId()).toBe('current');
    expect(navigate).not.toHaveBeenCalled();

    chooseEndRoom();
    const accepted = await vi.waitFor(() => http.expectOne({ method: 'DELETE', url: base }));
    accepted.flush(null, { status: 204, statusText: 'No Content' });
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith(['/rooms']));
    expect(store.room()).toBeNull();
    http.verify();
  });

  it.each([204, 503])('logs out after the leave endpoint returns %i', async (status) => {
    const { store, http, base, header } = await joinForHeaderAction('LISTENER');
    expect(header.querySelector('#endRoomBtn')).toBeNull();
    expect(header.querySelector('[aria-label="Log out"]')).toBeNull();
    const logout = vi
      .spyOn(TestBed.inject(AuthService), 'logout')
      .mockReturnValue(from(Promise.resolve()));
    void store.signOut();
    const leave = await vi.waitFor(() =>
      http.expectOne({ method: 'POST', url: base + '/participants/leave' }),
    );
    expect(logout).not.toHaveBeenCalled();
    leave.flush(null, { status, statusText: status === 204 ? 'No Content' : 'Unavailable' });
    await vi.waitFor(() =>
      expect(logout).toHaveBeenCalledWith({ logoutParams: { returnTo: window.location.origin } }),
    );
    expect(store.room()).toBeNull();
    http.verify();
  });

  it('redirects a room shortcut and binds the ID on subsequent navigation', async () => {
    const router = TestBed.inject(Router);
    const store = TestBed.inject(LiveRoomStore);
    const enterRoom = vi.spyOn(store, 'enterRoom').mockImplementation((_id, onDone) => {
      onDone?.(true);
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/room', HallwayRoute);
    expect(router.url).toBe('/rooms');

    store.rememberRoom('saved');
    const restored = await harness.navigateByUrl('/room', RoomPage);
    expect(router.url).toBe('/room/saved');
    expect(restored.id()).toBe('saved');
    expect(enterRoom).toHaveBeenCalledWith('saved');

    await harness.navigateByUrl('/room/second', RoomPage);
    expect(enterRoom.mock.calls).toEqual([['saved'], ['second']]);
  });

  it('should notify user when toggling microphone without stage publish permission', () => {
    vi.spyOn(TestBed.inject(LiveRoomStore), 'enterRoom').mockImplementation((_id, onDone) => {
      onDone?.(true);
    });
    const fixture = TestBed.createComponent(RoomPage);
    fixture.componentRef.setInput('id', 'current');
    fixture.detectChanges();

    fixture.componentInstance.facade.toggleMute('current');
    expect(toastSpy.show).toHaveBeenCalledWith('Join the stage to use your microphone.');
  });

  it('redirects to /rooms and shows toast when the room ends over LiveKit', async () => {
    let listener!: LiveKitListener;
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [RoomPage],
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        provideNoopAuthForTests(),
        provideRouter(
          [
            { path: 'room', children: ROOM_ROUTES },
            { path: 'rooms', component: HallwayRoute },
          ],
          withComponentInputBinding(),
        ),
        LiveRoomStore,
        {
          provide: LIVEKIT_CONNECTOR,
          useValue: async (
            _url: string,
            _token: string,
            _options: unknown,
            events: LiveKitListener,
          ) => {
            listener = events;
            return {
              setMicrophone: async () => undefined,
              setNoiseIsolation: async () => 'webrtc-fallback' as const,
              selectAudioInputDevice: async () => undefined,
              listAudioInputDevices: async () => [],
              startAudio: async () => undefined,
              disconnect: async () => undefined,
            };
          },
        },
        { provide: ToastNotifier, useValue: toastSpy },
        { provide: MatDialog, useValue: dialogSpy },
      ],
    }).compileComponents();

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(RoomPage);
    fixture.componentRef.setInput('id', 'current');
    fixture.detectChanges();

    const join = await vi.waitFor(() =>
      http.expectOne('/api/v1/voice-rooms/current/participants/join'),
    );
    join.flush({
      room: {
        id: 'current',
        title: 'Practice',
        hostId: 'host',
        targetLanguage: 'ar',
        nativeLanguage: 'en',
        maxStageSeats: 8,
        speakers: ['host'],
        participantCount: 1,
        handRaiseCount: 0,
      },
      role: 'LISTENER',
      canPublishAudio: false,
      liveKitUrl: 'wss://example.invalid',
      liveKitToken: 'token',
      snapshot: {
        speakers: [{ userId: 'host', displayName: 'Host', isReconnecting: false }],
        audienceCount: 0,
        audience: { audiencePreview: [], nextCursor: null, hasMoreAudience: false },
        handRaiseQueue: [],
        chat: { comments: [], muted: false, mutedUsers: [], reactions: [], topic: null },
      },
    });
    await vi.waitFor(() => expect(listener).toBeDefined());
    fixture.detectChanges();

    listener.onDisconnected('This room has ended.');
    fixture.detectChanges();

    expect(toastSpy.show).toHaveBeenCalledWith('Room closed.');
    expect(navigate).toHaveBeenCalledWith(['/rooms']);
    http.verify();
  });

  it('should report false from reloadMessages when not joined to an active room', () => {
    vi.spyOn(TestBed.inject(LiveRoomStore), 'enterRoom').mockImplementation((_id, onDone) => {
      onDone?.(true);
    });
    const fixture = TestBed.createComponent(RoomPage);
    fixture.componentRef.setInput('id', 'current');
    fixture.detectChanges();

    let reloaded: boolean | undefined;
    fixture.componentInstance.facade.retryChat((ok) => {
      reloaded = ok;
    });
    expect(reloaded).toBe(false);
  });

  it('requires confirmation before removing a speaker from the room', async () => {
    const { fixture, http, base } = await joinForHeaderAction('HOST');
    const targetSpeaker = {
      id: 'guest-1',
      name: 'Sam',
      initial: 'S',
      chipClass: 'avatar-chip-blue',
      role: 'speaker' as const,
      muted: false,
      speaking: false,
    };

    dialogSpy.open.mockReturnValueOnce({ afterClosed: () => from(Promise.resolve(false)) });
    fixture.componentInstance.onSpeakerAction({ action: 'remove', speaker: targetSpeaker });
    await Promise.resolve();
    http.expectNone({ method: 'DELETE', url: base + '/participants/guest-1' });

    dialogSpy.open.mockReturnValueOnce({ afterClosed: () => from(Promise.resolve(true)) });
    fixture.componentInstance.onSpeakerAction({ action: 'remove', speaker: targetSpeaker });
    const kick = await vi.waitFor(() =>
      http.expectOne({ method: 'DELETE', url: base + '/participants/guest-1' }),
    );
    kick.flush(null, { status: 204, statusText: 'No Content' });
    await vi.waitFor(() =>
      expect(toastSpy.show).toHaveBeenCalledWith('Sam removed from the room.'),
    );
    http.verify();
  });

  it('offers a Try again button when joining a room fails', async () => {
    const fixture = TestBed.createComponent(RoomPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('id', 'broken-room');
    fixture.detectChanges();

    const firstAttempt = await vi.waitFor(() =>
      http.expectOne('/api/v1/voice-rooms/broken-room/participants/join'),
    );
    firstAttempt.flush({ detail: 'Temporary error' }, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    fixture.detectChanges();

    const retryBtn = fixture.nativeElement.querySelector(
      '#retryJoinRoomBtn',
    ) as HTMLButtonElement | null;
    expect(retryBtn).toBeTruthy();
    retryBtn?.click();
    fixture.detectChanges();

    const secondAttempt = await vi.waitFor(() =>
      http.expectOne('/api/v1/voice-rooms/broken-room/participants/join'),
    );
    secondAttempt.flush({ detail: 'Still down' }, { status: 503, statusText: 'Unavailable' });
    http.verify();
  });
});
