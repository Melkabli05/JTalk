import { BreakpointObserver } from '@angular/cdk/layout';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { computed, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { from } from 'rxjs';
import { vi } from 'vitest';
import { LiveRoomStore } from '../../features/room/store/live-room-store';
import { VoiceRoomDto } from '../../shared/models/voice-room.model';
import { ToastNotifier } from '../../core/services/toast-notifier';
import { MainLayout } from './main-layout';

describe('MainLayout', () => {
  const breakpointStub = {
    observe: () => from([{ matches: false, breakpoints: {} }]),
  };
  const dialogSpy = {
    getDialogById: vi.fn(() => undefined),
    open: vi.fn(() => ({ afterClosed: () => from([undefined]) })),
  };
  const toastSpy = { show: vi.fn() };
  const room = signal<VoiceRoomDto | null>(null);
  const roomStore = {
    room: room.asReadonly(),
    roomId: computed(() => room()?.id ?? null),
    practiseLangLabel: signal('French'),
  };

  beforeEach(async () => {
    room.set(null);
    dialogSpy.open.mockClear();
    toastSpy.show.mockClear();
    await TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isLoading$: from([false]),
            isAuthenticated$: from([true]),
            user$: from([{ 'https://jtalk.app/user_id': 'u-1', name: 'Amina' }]),
            error$: from([null]),
            getAccessTokenSilently: () => from(['tok']),
            loginWithRedirect: vi.fn(),
            logout: () => from([undefined]),
          },
        },
        { provide: BreakpointObserver, useValue: breakpointStub },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: ToastNotifier, useValue: toastSpy },
        { provide: LiveRoomStore, useValue: roomStore },
      ],
    }).compileComponents();
  });

  it('should render sidebar, banner, router outlet, and mobile tabbar', () => {
    const fixture = TestBed.createComponent(MainLayout);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-sidebar')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-inroom-banner')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-mobile-tabbar')).toBeTruthy();
    expect(fixture.componentInstance.isPhoneViewport()).toBe(false);
  });

  it('should reflect RoomsStore liveCount changes from real SSE events', () => {
    const fixture = TestBed.createComponent(MainLayout);
    fixture.componentInstance.roomsStore.applyFeedEvent({
      type: 'SNAPSHOT',
      rooms: [
        {
          id: 'r-1',
          title: 'Room 1',
          topic: '',
          hostId: 'u-1',
          targetLanguage: 'en',
          nativeLanguage: 'es',
          maxStageSeats: 6,
          speakers: ['u-1'],
          participantCount: 2,
          handRaiseCount: 0,
        },
        {
          id: 'r-2',
          title: 'Room 2',
          topic: '',
          hostId: 'u-2',
          targetLanguage: 'fr',
          nativeLanguage: 'en',
          maxStageSeats: 6,
          speakers: ['u-2'],
          participantCount: 3,
          handRaiseCount: 0,
        },
      ],
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.roomsStore.liveCount()).toBe(2);
    fixture.componentInstance.roomsStore.hideRoom('r-1');
    fixture.detectChanges();

    expect(fixture.componentInstance.roomsStore.liveCount()).toBe(1);
  });

  it('shows the current room title and seat count from the room state', () => {
    const fixture = TestBed.createComponent(MainLayout);
    room.set({
      id: 'room',
      title: 'Practice',
      topic: '',
      hostId: 'host',
      targetLanguage: 'fr',
      nativeLanguage: 'en',
      maxStageSeats: 6,
      speakers: ['host'],
      participantCount: 1,
      handRaiseCount: 0,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.inroom-meta')?.textContent).toContain('6 seats');

    room.update((current) =>
      current ? { ...current, title: 'Renamed room', maxStageSeats: 9 } : null,
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.inroom-room-name')?.textContent).toContain(
      'Renamed room',
    );
    expect(fixture.nativeElement.querySelector('.inroom-meta')?.textContent).toContain('9 seats');

    room.set(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.inroom-meta')).toBeNull();
  });

  it('should open StartRoomDialog when requested by an authenticated user', async () => {
    const fixture = TestBed.createComponent(MainLayout);
    fixture.detectChanges();

    fixture.componentInstance.onOpenStartRoom();
    await vi.waitFor(() => expect(dialogSpy.open).toHaveBeenCalled());
  });
});
