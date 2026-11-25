import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { provideNoopAuthForTests } from '../../../../core/auth/auth.providers';
import { ToastNotifier } from '../../../../core/services/toast-notifier';
import { RoomsStore } from '../../store/rooms-store';
import { RoomsPage } from './rooms-page';

describe('RoomsPage', () => {
  const toastSpy = { show: vi.fn() };

  beforeEach(async () => {
    toastSpy.show.mockReset();
    await TestBed.configureTestingModule({
      imports: [RoomsPage],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAuthForTests(),
        provideRouter([]),
        RoomsStore,
        { provide: ToastNotifier, useValue: toastSpy },
      ],
    }).compileComponents();
  });

  it('should render hero, language filter chips, and room list container', () => {
    const fixture = TestBed.createComponent(RoomsPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-rooms-hero')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-language-chips')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#live-h')?.textContent).toContain('Live rooms');
  });

  it('should apply SSE feed snapshots and filter rooms by language', () => {
    const fixture = TestBed.createComponent(RoomsPage);
    const store = fixture.componentInstance.roomsStore;

    store.applyFeedEvent({
      type: 'SNAPSHOT',
      rooms: [
        {
          id: 'room-1',
          title: 'Tokyo Night Chat',
          topic: 'Daily idioms',
          hostId: 'u-1',
          targetLanguage: 'ja',
          nativeLanguage: 'en',
          maxStageSeats: 6,
          speakers: ['u-1'],
          participantCount: 3,
          handRaiseCount: 0,
        },
        {
          id: 'room-2',
          title: 'Café Français',
          topic: 'Films & voyage',
          hostId: 'u-2',
          targetLanguage: 'fr',
          nativeLanguage: 'en',
          maxStageSeats: 8,
          speakers: ['u-2'],
          participantCount: 5,
          handRaiseCount: 1,
        },
      ],
    });
    fixture.detectChanges();

    expect(store.liveCount()).toBe(2);
    store.selectedFilter.set('ja');
    expect(store.filteredRooms().map((r) => r.id)).toEqual(['room-1']);

    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('app-room-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('Tokyo Night Chat');
  });
});
