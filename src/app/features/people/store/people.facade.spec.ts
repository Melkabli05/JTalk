import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { DiscoveredUserResponse } from '../../../core/auth/auth.models';
import { IdentityStore } from '../../../core/auth/identity';
import { ToastNotifier } from '../../../core/services/toast-notifier';
import { PeopleFacade } from './people.facade';
import { PeopleStore } from './people.store';

function makeUser(overrides: Partial<DiscoveredUserResponse> = {}): DiscoveredUserResponse {
  return {
    id: 'u-1',
    username: 'user1',
    displayName: 'User One',
    avatarUrl: null,
    nativeLanguage: 'en',
    followedByMe: false,
    ...overrides,
  };
}

describe('PeopleFacade', () => {
  const signedIn = signal(true);
  const toastSpy = { show: vi.fn() };
  const identityMock = {
    isAuthenticated: signedIn,
    userId: signal(null),
    userDirectory: signal(new Map()),
    mergeUserSummaries: vi.fn(),
    refreshSocialStats: vi.fn(),
  };

  beforeEach(() => {
    signedIn.set(true);
    toastSpy.show.mockReset();
    identityMock.mergeUserSummaries.mockReset();
    identityMock.refreshSocialStats.mockReset();
    TestBed.configureTestingModule({
      providers: [
        PeopleStore,
        PeopleFacade,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: IdentityStore, useValue: identityMock },
        { provide: ToastNotifier, useValue: toastSpy },
      ],
    });
  });

  it('debounces the query, cancels obsolete requests and retains matchmaking on clear', async () => {
    const facade = TestBed.inject(PeopleFacade);
    const http = TestBed.inject(HttpTestingController);
    const partner = makeUser({
      id: 'match',
      username: 'match',
      displayName: 'Partner',
      nativeLanguage: 'ar',
      followedByMe: true,
    });

    TestBed.tick();
    http.expectOne('/api/v1/users/matchmaking?size=24').flush({
      content: [partner],
      hasNext: true,
      nextAfterCreatedAt: 'date',
      nextAfterId: 'match',
    });
    await vi.waitFor(() => expect(facade.people().map((p) => p.displayName)).toEqual(['Partner']));
    expect(facade.people()[0]?.followedByMe).toBe(true);

    facade.setQuery('am');
    TestBed.tick();
    const oldRequest = await vi.waitFor(() => http.expectOne('/api/v1/users/search?q=am&size=30'), {
      timeout: 2000,
    });
    facade.setQuery('amira');
    TestBed.tick();
    expect(oldRequest.cancelled).toBe(true);

    const request = await vi.waitFor(() => http.expectOne('/api/v1/users/search?q=amira&size=30'), {
      timeout: 2000,
    });
    const searchResult = [
      makeUser({ id: 'search', username: 'amira', displayName: 'Amira', nativeLanguage: 'ar' }),
    ];
    request.flush(searchResult);
    await vi.waitFor(() => expect(facade.people().map((p) => p.displayName)).toEqual(['Amira']));
    expect(identityMock.mergeUserSummaries).toHaveBeenCalledWith(searchResult);
    expect(facade.hasMore()).toBe(false);

    facade.setQuery('');
    TestBed.tick();
    expect(facade.people().map((p) => p.displayName)).toEqual(['Partner']);
    expect(facade.hasMore()).toBe(true);
    facade.loadMore();
    TestBed.tick();
    http.expectOne('/api/v1/users/matchmaking?size=24&afterCreatedAt=date&afterId=match').flush({
      content: [{ ...partner, id: 'second', displayName: 'Second partner' }],
      hasNext: false,
      nextAfterCreatedAt: null,
      nextAfterId: null,
    });
    await vi.waitFor(() =>
      expect(facade.people().map((p) => p.displayName)).toEqual(['Partner', 'Second partner']),
    );
    expect(facade.hasMore()).toBe(false);

    signedIn.set(false);
    TestBed.tick();
    expect(facade.people()).toEqual([]);
    http.verify();
  });

  it('exposes error status without throwing on people() and recovers on refresh()', async () => {
    const facade = TestBed.inject(PeopleFacade);
    const http = TestBed.inject(HttpTestingController);

    TestBed.tick();
    http
      .expectOne('/api/v1/users/matchmaking?size=24')
      .flush({ message: 'Matchmaking unavailable' }, { status: 500, statusText: 'Server Error' });

    await vi.waitFor(() => expect(facade.status()).toBe('error'));
    expect(facade.error()).toBe('Could not load people.');
    expect(() => facade.people()).not.toThrow();
    expect(facade.people()).toEqual([]);

    facade.refresh();
    TestBed.tick();
    http.expectOne('/api/v1/users/matchmaking?size=24').flush({
      content: [
        makeUser({ id: 'p-1', username: 'kenji', displayName: 'Kenji', nativeLanguage: 'ja' }),
      ],
      hasNext: false,
      nextAfterCreatedAt: null,
      nextAfterId: null,
    });

    await vi.waitFor(() => expect(facade.status()).toBe('resolved'));
    expect(facade.people().map((p) => p.displayName)).toEqual(['Kenji']);
    http.verify();
  });

  it('tracks pending state, updates follow overrides, and handles blockUser', async () => {
    const facade = TestBed.inject(PeopleFacade);
    const http = TestBed.inject(HttpTestingController);
    const alice = makeUser({ id: 'alice', displayName: 'Alice', followedByMe: false });
    const bob = makeUser({ id: 'bob', displayName: 'Bob', followedByMe: true });

    TestBed.tick();
    http.expectOne('/api/v1/users/matchmaking?size=24').flush({
      content: [alice, bob],
      hasNext: false,
      nextAfterCreatedAt: null,
      nextAfterId: null,
    });
    await vi.waitFor(() => expect(facade.people()).toHaveLength(2));

    facade.toggleFollow(alice);
    expect(facade.busyIds().has('alice')).toBe(true);
    http.expectOne({ method: 'POST', url: '/api/v1/users/alice/follow' }).flush(null);
    expect(facade.busyIds().has('alice')).toBe(false);
    expect(facade.people().find((p) => p.id === 'alice')?.followedByMe).toBe(true);
    expect(identityMock.refreshSocialStats).toHaveBeenCalledTimes(1);
    expect(toastSpy.show).toHaveBeenCalledWith('Following Alice.');

    facade.blockUser(bob);
    expect(facade.busyIds().has('bob')).toBe(true);
    http.expectOne({ method: 'POST', url: '/api/v1/users/bob/block' }).flush(null);
    expect(facade.busyIds().has('bob')).toBe(false);
    expect(facade.people().map((p) => p.id)).toEqual(['alice']);
    expect(toastSpy.show).toHaveBeenCalledWith('Blocked Bob.');
    http.verify();
  });
});
