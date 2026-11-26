import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { from } from 'rxjs';
import { vi } from 'vitest';
import { provideNoopAuthForTests } from '../../../../core/auth/auth.providers';
import { IdentityStore } from '../../../../core/auth/identity';
import { ToastNotifier } from '../../../../core/services/toast-notifier';
import { ProfilePage } from './profile-page';

describe('ProfilePage', () => {
  const toastSpy = { show: vi.fn() };
  const dialogSpy = {
    open: vi.fn(() => ({ afterClosed: () => from([true]) })),
  };

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
        provideRouter([{ path: 'profile', component: ProfilePage }]),
        { provide: ToastNotifier, useValue: toastSpy },
        { provide: MatDialog, useValue: dialogSpy },
      ],
    }).compileComponents();
  });

  it('hydrates active tab from ?tab=, syncs tab changes to URL, and invokes deleteAccount on confirmation', async () => {
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);
    const identity = TestBed.inject(IdentityStore);
    const deleteSpy = vi.spyOn(identity, 'deleteAccount').mockResolvedValue({ ok: true });

    const page = await harness.navigateByUrl('/profile?tab=account', ProfilePage);
    expect(page.activeTab()).toBe('account');
    expect(page.selectedTabIndex()).toBe(2);

    page.selectTab('edit');
    await vi.waitFor(() => expect(router.url).toBe('/profile?tab=edit'));
    expect(page.selectedTabIndex()).toBe(1);

    page.selectTab('overview');
    await vi.waitFor(() => expect(router.url).toBe('/profile'));
    expect(page.selectedTabIndex()).toBe(0);

    await page.openDeleteDialog();
    expect(dialogSpy.open).toHaveBeenCalled();
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  it('renders inline error and recovers via Retry when loading connections fails', async () => {
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
    });

    const harness = await RouterTestingHarness.create();
    const http = TestBed.inject(HttpTestingController);
    const page = await harness.navigateByUrl('/profile', ProfilePage);

    page.loadConnections('followers');
    TestBed.tick();
    http
      .expectOne('/api/v1/users/me-1/followers?page=0&size=30')
      .flush({ message: 'Unavailable' }, { status: 500, statusText: 'Server Error' });

    await vi.waitFor(() => expect(page.connectionsStatus()).toBe('error'));
    harness.detectChanges();

    expect(() => page.connections()).not.toThrow();
    const alert = harness.routeNativeElement?.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Could not load accounts.');

    page.retryConnections();
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

    await vi.waitFor(() => expect(page.connectionsStatus()).toBe('resolved'));
    harness.detectChanges();
    expect(page.connections().map((a) => a.displayName)).toEqual(['Amira']);
    expect(harness.routeNativeElement?.textContent).toContain('Amira');
    http.verify();
  });
});
