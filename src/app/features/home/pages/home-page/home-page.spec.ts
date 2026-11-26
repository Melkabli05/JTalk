import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { from } from 'rxjs';
import { vi } from 'vitest';
import { RoomLauncher } from '../../../../core/services/room-launcher';
import { RoomsFacade } from '../../../rooms/store/rooms.facade';
import { HomePage } from './home-page';

describe('HomePage', () => {
  const loginSpy = vi.fn();

  function setup(authenticated: boolean) {
    loginSpy.mockReset();
    return TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'rooms', component: HomePage },
          { path: 'room/:id', component: HomePage },
        ]),
        {
          provide: AuthService,
          useValue: {
            isLoading$: from([false]),
            isAuthenticated$: from([authenticated]),
            user$: from([authenticated ? { 'https://jtalk.app/user_id': 'u-1', name: 'Amina' } : null]),
            error$: from([null]),
            getAccessTokenSilently: () => from(['tok']),
            loginWithRedirect: loginSpy,
            logout: () => from([undefined]),
          },
        },
      ],
    }).compileComponents();
  }

  it('renders the minimalist headline, copy, and Auth0 sign-in trigger when signed out', async () => {
    await setup(false);
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Learn a language by talking.',
    );
    expect(el.textContent).toContain(
      "Drop into a room, listen first, and speak when you're ready.",
    );
    expect(el.querySelectorAll('.home-greeting').length).toBe(6);

    (el.querySelector('.home-signin-btn') as HTMLButtonElement).click();
    expect(loginSpy).toHaveBeenCalledTimes(1);

    const themeBtn = el.querySelector('.home-theme-btn') as HTMLButtonElement | null;
    const brandImg = el.querySelector('.home-brand img.brand-mark') as HTMLImageElement | null;
    expect(themeBtn).toBeTruthy();
    expect(brandImg?.getAttribute('src')).toBe('brand/jtalk-mark.svg');

    themeBtn?.click();
    fixture.detectChanges();
    expect(brandImg?.getAttribute('src')).toBe('brand/jtalk-mark-dark.svg');
    themeBtn?.click();
    fixture.detectChanges();
    expect(brandImg?.getAttribute('src')).toBe('brand/jtalk-mark.svg');
  });

  it('cycles live rooms from the SSE snapshot and navigates to /room/:id when signed in', async () => {
    await setup(true);
    const fixture = TestBed.createComponent(HomePage);
    const roomsStore = TestBed.inject(RoomsFacade);
    const router = TestBed.inject(Router);
    const launcher = TestBed.inject(RoomLauncher);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const openSpy = vi.spyOn(launcher, 'openStartRoom').mockResolvedValue(undefined);

    roomsStore.applyFeedEvent({
      type: 'SNAPSHOT',
      rooms: [
        {
          id: 'room-en',
          title: 'Evening conversation club',
          topic: 'Weekend plans',
          hostId: 'u-1',
          targetLanguage: 'en',
          nativeLanguage: 'ar',
          maxStageSeats: 6,
          speakers: ['u-1'],
          participantCount: 4,
          handRaiseCount: 0,
        },
        {
          id: 'room-fr',
          title: 'Café français du soir',
          topic: 'Films et voyages',
          hostId: 'u-2',
          targetLanguage: 'fr',
          nativeLanguage: 'en',
          maxStageSeats: 8,
          speakers: ['u-2'],
          participantCount: 6,
          handRaiseCount: 1,
        },
      ],
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.home-live-title')?.textContent?.trim()).toBe(
      'Evening conversation club',
    );
    expect(el.querySelector('.home-live-index')?.textContent?.trim()).toBe('01 / 02');

    (el.querySelector('.home-live-index') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.autoCyclePaused()).toBe(true);
    expect(el.querySelector('.home-live-title')?.textContent?.trim()).toBe(
      'Café français du soir',
    );

    (el.querySelector('.home-live-join') as HTMLButtonElement).click();
    expect(navSpy).toHaveBeenCalledWith(['/room', 'room-fr']);

    (el.querySelector('.home-primary-btn') as HTMLButtonElement).click();
    expect(navSpy).toHaveBeenCalledWith(['/rooms']);

    (el.querySelector('.home-secondary-btn') as HTMLButtonElement).click();
    expect(openSpy).toHaveBeenCalledTimes(1);
  });
});
