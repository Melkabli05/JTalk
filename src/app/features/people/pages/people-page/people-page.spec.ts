import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { provideNoopAuthForTests } from '../../../../core/auth/auth.providers';
import type { DiscoveredUserResponse } from '../../../../core/auth/auth.models';
import { ToastNotifier } from '../../../../core/services/toast-notifier';
import { PeopleFacade } from '../../store/people.facade';
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
        PeopleFacade,
        provideRouter([{ path: 'people', component: PeoplePage }]),
        { provide: ToastNotifier, useValue: toastSpy },
      ],
    }).compileComponents();
  });

  it('should render people directory search input and delegate follow toggle to PeopleFacade', async () => {
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

    const toggleSpy = vi.spyOn(page.facade, 'toggleFollow');
    harness.detectChanges();

    expect(harness.routeNativeElement?.querySelector('input[type="search"]')).toBeTruthy();

    page.facade.toggleFollow(person);
    expect(toggleSpy).toHaveBeenCalledWith(person);
  });

  it('hydrates search query from ?q= and syncs query changes to the URL', async () => {
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);
    const page = await harness.navigateByUrl('/people?q=amira', PeoplePage);

    expect(page.facade.query()).toBe('amira');

    page.facade.setQuery('kenji');
    await vi.waitFor(() => expect(router.url).toBe('/people?q=kenji'));
  });
});
