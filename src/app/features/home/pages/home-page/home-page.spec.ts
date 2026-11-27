import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '@auth0/auth0-angular';
import { from } from 'rxjs';
import { vi } from 'vitest';
import { HomePage } from './home-page';

@Component({ selector: 'app-dummy-target', template: '' })
class DummyTarget {}

describe('HomePage', () => {
  const loginSpy = vi.fn(() => from([undefined]));

  function setup(options: { authenticated: boolean; loading?: boolean; error?: Error | null }) {
    const { authenticated, loading = false, error = null } = options;
    loginSpy.mockReset().mockReturnValue(from([undefined]));
    return TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: '', component: HomePage },
          { path: 'rooms', component: DummyTarget },
          { path: 'room/:id', component: DummyTarget },
        ]),
        {
          provide: AuthService,
          useValue: {
            isLoading$: from([loading]),
            isAuthenticated$: from([authenticated]),
            user$: from([
              authenticated ? { 'https://jtalk.app/user_id': 'u-1', name: 'Amina' } : null,
            ]),
            error$: from([error]),
            getAccessTokenSilently: () => from(['tok']),
            loginWithRedirect: loginSpy,
            logout: () => from([undefined]),
          },
        },
      ],
    }).compileComponents();
  }

  it('renders the minimalist headline, signs in with login mode, and preserves Start Room intent', async () => {
    await setup({ authenticated: false });
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
    expect(loginSpy).toHaveBeenCalledWith({ appState: { target: '/rooms' } });

    (el.querySelector('.home-secondary-btn') as HTMLButtonElement).click();
    expect(loginSpy).toHaveBeenCalledWith({ appState: { target: '/rooms?action=start' } });

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

  it('automatically redirects authenticated visitors to /rooms or sanitized ?next= target', async () => {
    await setup({ authenticated: true });
    const router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/?next=/room/room-fr');
    await vi.waitFor(() => expect(router.url).toBe('/room/room-fr'));
  });

  it('sanitizes unsafe ?next= redirect parameters back to /rooms', async () => {
    await setup({ authenticated: false });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/?next=//evil.example/phish', HomePage);

    const btn = harness.routeNativeElement?.querySelector('.home-signin-btn') as HTMLButtonElement;
    btn.click();
    expect(loginSpy).toHaveBeenCalledWith({ appState: { target: '/rooms' } });
  });

  it('disables sign-in buttons and blocks clicks while Auth0 session or callback is loading', async () => {
    await setup({ authenticated: false, loading: true });
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const signInBtn = el.querySelector('.home-signin-btn') as HTMLButtonElement;
    expect(signInBtn.disabled).toBe(true);
    expect(signInBtn.textContent?.trim()).toBe('Signing in…');

    fixture.componentInstance.enterRooms();
    fixture.componentInstance.openStartRoom();
    expect(loginSpy).not.toHaveBeenCalled();
  });

  it('renders an auth error alert banner and clears sessionExpired on destroy', async () => {
    await setup({ authenticated: false, error: new Error('access_denied') });
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Sign-in could not be completed. Please try again.',
    );
    fixture.destroy();
  });
});
