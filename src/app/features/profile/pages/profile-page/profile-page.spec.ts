import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { provideNoopAuthForTests } from '../../../../core/auth/auth.providers';
import { IdentityStore } from '../../../../core/auth/identity';
import { ToastNotifier } from '../../../../core/services/toast-notifier';
import { PROFILE_ROUTES } from '../../profile.routes';
import { ProfilePage } from './profile-page';

describe('ProfilePage (routed shell & overview)', () => {
  const toastSpy = { show: vi.fn() };
  const dialogSpy = { open: vi.fn(() => ({ afterClosed: () => of(true) })) };

  beforeEach(async () => {
    toastSpy.show.mockReset();
    dialogSpy.open.mockClear();
    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAuthForTests(),
        provideRouter([{ path: 'profile', children: PROFILE_ROUTES }]),
        { provide: ToastNotifier, useValue: toastSpy },
        { provide: MatDialog, useValue: dialogSpy },
      ],
    }).compileComponents();
  });

  it('redirects legacy ?tab=edit and ?tab=account deep links to child routes and hides overview header on Edit/Account', async () => {
    const identity = TestBed.inject(IdentityStore);
    identity.setProfile({
      id: 'me-1',
      displayName: 'Yuki',
      username: 'yuki',
      avatarUrl: null,
      nativeLanguage: 'ja',
      nativeLanguages: ['ja'],
      learningLanguages: [{ languageCode: 'en', proficiencyLevel: 'INTERMEDIATE' }],
      countryCode: 'JP',
      bio: '',
      createdAt: '2026-01-01T00:00:00Z',
      socialStats: {
        followerCount: 1,
        followingCount: 3,
        followedByMe: false,
        followsMe: false,
      },
    });

    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);

    await harness.navigateByUrl('/profile');
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('app-profile-header')).toBeTruthy();
    expect(harness.routeNativeElement?.textContent).toContain('1 follower');
    expect(harness.routeNativeElement?.textContent).not.toContain('1 Followers');

    await harness.navigateByUrl('/profile?tab=account');
    await vi.waitFor(() => expect(router.url).toBe('/profile/account'));
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('app-profile-header')).toBeNull();

    await harness.navigateByUrl('/profile?tab=edit');
    await vi.waitFor(() => expect(router.url).toBe('/profile/edit'));
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('.phead-surface:not(.phead-compact)')).toBeNull();
    expect(harness.routeNativeElement?.querySelector('.pe-preview-aside .phead-compact')).toBeTruthy();
  });

  it('opens connections panel from follower count click, handles errors, and recovers via Retry', async () => {
    const identity = TestBed.inject(IdentityStore);
    identity.setProfile({
      id: 'me-1',
      displayName: 'Yuki',
      username: 'yuki',
      avatarUrl: null,
      nativeLanguage: 'ja',
      nativeLanguages: ['ja'],
      learningLanguages: [],
      countryCode: 'JP',
      bio: '',
      createdAt: '2026-01-01T00:00:00Z',
      socialStats: {
        followerCount: 2,
        followingCount: 1,
        followedByMe: false,
        followsMe: false,
      },
    });

    const harness = await RouterTestingHarness.create();
    const http = TestBed.inject(HttpTestingController);
    await harness.navigateByUrl('/profile');
    harness.detectChanges();

    const followersBtn = harness.routeNativeElement?.querySelector(
      '#followersCountBtn',
    ) as HTMLButtonElement;
    expect(followersBtn).toBeTruthy();
    followersBtn.click();
    TestBed.tick();

    http
      .expectOne('/api/v1/users/me-1/followers?page=0&size=30')
      .flush({ message: 'Unavailable' }, { status: 500, statusText: 'Server Error' });

    await vi.waitFor(() => {
      harness.detectChanges();
      const alert = harness.routeNativeElement?.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('Could not load accounts.');
    });

    const retryBtn = harness.routeNativeElement?.querySelector(
      '#profileConnectionsPanel [role="alert"] button',
    ) as HTMLButtonElement;
    retryBtn.click();
    TestBed.tick();

    http.expectOne('/api/v1/users/me-1/followers?page=0&size=30').flush({
      content: [
        {
          id: 'u-2',
          displayName: 'Amira',
          username: 'amira',
          avatarUrl: null,
          nativeLanguage: 'ar',
        },
      ],
      page: 0,
      size: 30,
      total: 1,
    });

    await vi.waitFor(() => {
      harness.detectChanges();
      expect(harness.routeNativeElement?.textContent).toContain('Amira');
    });
    http.verify();
  });

  it('renders loading skeleton, error state with Retry/Sign out, and onboarding form without fake Speaker profile', async () => {
    TestBed.resetTestingModule();
    const { AuthService } = await import('@auth0/auth0-angular');
    const { httpErrorInterceptor } = await import('../../../../core/http/http-error.interceptor');
    const { withInterceptors } = await import('@angular/common/http');
    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'profile', children: PROFILE_ROUTES }]),
        { provide: ToastNotifier, useValue: toastSpy },
        { provide: MatDialog, useValue: dialogSpy },
        {
          provide: AuthService,
          useValue: {
            isLoading$: of(false),
            isAuthenticated$: of(true),
            user$: of({ name: 'Mohammed' }),
            error$: of(null),
            logout: () => of(undefined),
          },
        },
      ],
    }).compileComponents();

    const harness = await RouterTestingHarness.create();
    const http = TestBed.inject(HttpTestingController);
    await harness.navigateByUrl('/profile');
    harness.detectChanges();

    expect(harness.routeNativeElement?.querySelector('#profileLoadingState')).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('app-profile-header')).toBeNull();

    http
      .expectOne('/api/v1/users/me')
      .flush({ message: 'Server error' }, { status: 500, statusText: 'Server Error' });
    await vi.waitFor(() =>
      expect(harness.routeNativeElement?.querySelector('#profileLoadError')).toBeTruthy(),
    );
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain("Couldn't load your profile");
    expect(harness.routeNativeElement?.textContent).toContain('Retry');
    expect(harness.routeNativeElement?.textContent).toContain('Sign out');

    const retryBtn = harness.routeNativeElement?.querySelector(
      '#profileLoadError button',
    ) as HTMLButtonElement;
    retryBtn.click();
    TestBed.tick();
    http
      .expectOne('/api/v1/users/me')
      .flush(
        { type: 'urn:jtalk:user:problem:user-not-found' },
        { status: 404, statusText: 'Not Found' },
      );
    await vi.waitFor(() =>
      expect(harness.routeNativeElement?.querySelector('#profileOnboardingBanner')).toBeTruthy(),
    );
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('.phead-surface:not(.phead-compact)')).toBeNull();
    expect(harness.routeNativeElement?.querySelector('app-profile-edit-form')).toBeTruthy();
    http.verify();
  });
});
