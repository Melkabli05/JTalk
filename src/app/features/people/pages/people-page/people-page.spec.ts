import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import type { DiscoveredUserResponse } from '../../../../core/auth/auth.models';
import { provideNoopAuthForTests } from '../../../../core/auth/auth.providers';
import { ToastNotifier } from '../../../../core/services/toast-notifier';
import { PeoplePage } from './people-page';

describe('PeoplePage', () => {
  const toastSpy = { show: vi.fn() };

  beforeEach(async () => {
    toastSpy.show.mockReset();
    await TestBed.configureTestingModule({
      imports: [PeoplePage],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAuthForTests(),
        provideRouter([{ path: 'people', component: PeoplePage }]),
        { provide: ToastNotifier, useValue: toastSpy },
      ],
    }).compileComponents();
  });

  it('should render people directory search input and handle follow toggle feedback', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/people', PeoplePage);
    const person: DiscoveredUserResponse = {
      id: 'u-1',
      displayName: 'Amira',
      username: 'amira',
      avatarUrl: null,
      nativeLanguage: 'ar',
      followedByMe: false,
    };

    vi.spyOn(page.peopleStore, 'toggleFollow').mockImplementation((_person, onDone) => {
      onDone?.({ ok: true, followed: true });
    });
    harness.detectChanges();

    expect(harness.routeNativeElement?.querySelector('input[type="search"]')).toBeTruthy();

    page.onFollowToggle(person);
    expect(toastSpy.show).toHaveBeenCalledWith('Following Amira.');
  });

  it('hydrates search query from ?q= and syncs query changes to the URL', async () => {
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);
    const page = await harness.navigateByUrl('/people?q=amira', PeoplePage);

    expect(page.peopleStore.query()).toBe('amira');

    page.onQueryChange('kenji');
    await vi.waitFor(() => expect(router.url).toBe('/people?q=kenji'));
    expect(page.peopleStore.query()).toBe('kenji');

    page.onQueryChange('');
    await vi.waitFor(() => expect(router.url).toBe('/people'));
    expect(page.peopleStore.query()).toBe('');
  });
});
