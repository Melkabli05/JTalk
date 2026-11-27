import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { provideNoopAuthForTests } from '../../../../core/auth/auth.providers';
import { ToastNotifier } from '../../../../core/services/toast-notifier';
import { RoomsFacade } from '../../store/rooms.facade';
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
        provideRouter([{ path: 'rooms', component: RoomsPage }]),
        RoomsFacade,
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

  it('hydrates language filter from URL query param and delegates filtering to RoomsStore', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/rooms?lang=ja', RoomsPage);
    const router = TestBed.inject(Router);
    const store = page.facade;

    expect(page.selectedFilter()).toBe('ja');
    expect(store.targetLanguage()).toBe('ja');

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
          host: { id: 'u-1', displayName: 'Yuki', username: 'yuki', avatarUrl: null },
        },
      ],
    });
    harness.detectChanges();

    const cards = harness.routeNativeElement?.querySelectorAll('app-room-card');
    expect(cards).toHaveLength(1);
    expect(cards?.[0]?.textContent).toContain('Tokyo Night Chat');

    page.onFilterChange('fr');
    await vi.waitFor(() => expect(router.url).toBe('/rooms?lang=fr'));
    expect(store.targetLanguage()).toBe('fr');

    page.onFilterChange('all');
    await vi.waitFor(() => expect(router.url).toBe('/rooms'));
    expect(store.targetLanguage()).toBe('all');
  });

  it('opens the Start Room flow once when arriving with ?action=start and clears the query param', async () => {
    const facade = TestBed.inject(RoomsFacade);
    const startSpy = vi.spyOn(facade, 'startRoom').mockImplementation(() => undefined);
    const router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/rooms?action=start', RoomsPage);
    await vi.waitFor(() => expect(router.url).toBe('/rooms'));
    expect(startSpy).toHaveBeenCalledTimes(1);
  });
});
