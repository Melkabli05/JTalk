import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { IdentityStore } from '../../../core/auth/identity';
import { PeopleStore } from './people-store';

describe('PeopleStore search', () => {
  it('debounces the query, cancels obsolete requests and retains matchmaking on clear', async () => {
    const signedIn = signal(true);
    TestBed.configureTestingModule({
      providers: [
        PeopleStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: IdentityStore,
          useValue: {
            isAuthenticated: signedIn,
            userId: signal(null),
            mergeUserSummaries: vi.fn(),
          },
        },
      ],
    });
    const store = TestBed.inject(PeopleStore);
    const http = TestBed.inject(HttpTestingController);
    const partner = { id: 'match', username: 'match', displayName: 'Partner', nativeLanguage: 'ar', followedByMe: true };

    TestBed.tick();
    http.expectOne('/api/v1/users/matchmaking?size=24').flush({ content: [partner], hasNext: true, nextAfterCreatedAt: 'date', nextAfterId: 'match' });
    await vi.waitFor(() => expect(store.people().map((person) => person.displayName)).toEqual(['Partner']));
    expect(store.people()[0]?.followedByMe).toBe(true);

    store.setQuery('am');
    TestBed.tick();
    const oldRequest = await vi.waitFor(() => http.expectOne('/api/v1/users/search?q=am&size=30'), { timeout: 2000 });
    store.setQuery('amira');
    TestBed.tick();
    expect(oldRequest.cancelled).toBe(true);

    const request = await vi.waitFor(() => http.expectOne('/api/v1/users/search?q=amira&size=30'), { timeout: 2000 });
    const searchResult = [{ id: 'search', username: 'amira', displayName: 'Amira', nativeLanguage: 'ar', followedByMe: false }];
    request.flush(searchResult);
    await vi.waitFor(() => expect(store.people().map((person) => person.displayName)).toEqual(['Amira']));
    expect(TestBed.inject(IdentityStore).mergeUserSummaries).toHaveBeenCalledWith(searchResult);
    expect(store.people()[0]?.followedByMe).toBe(false);
    expect(store.hasMore()).toBe(false);

    store.setQuery('');
    TestBed.tick();
    expect(store.people().map((person) => person.displayName)).toEqual(['Partner']);
    expect(store.hasMore()).toBe(true);
    store.loadMore();
    TestBed.tick();
    http.expectOne('/api/v1/users/matchmaking?size=24&afterCreatedAt=date&afterId=match').flush({
      content: [{ ...partner, id: 'second', displayName: 'Second partner' }],
      hasNext: false, nextAfterCreatedAt: null, nextAfterId: null,
    });
    await vi.waitFor(() => expect(store.people().map(person => person.displayName)).toEqual(['Partner', 'Second partner']));
    expect(store.hasMore()).toBe(false);

    signedIn.set(false);
    TestBed.tick();
    expect(store.people()).toEqual([]);
    http.verify();
  });

  it('exposes error status without throwing on people() and recovers on refresh()', async () => {
    const signedIn = signal(true);
    TestBed.configureTestingModule({
      providers: [
        PeopleStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: IdentityStore,
          useValue: {
            isAuthenticated: signedIn,
            userId: signal(null),
            mergeUserSummaries: vi.fn(),
          },
        },
      ],
    });
    const store = TestBed.inject(PeopleStore);
    const http = TestBed.inject(HttpTestingController);

    TestBed.tick();
    http
      .expectOne('/api/v1/users/matchmaking?size=24')
      .flush({ message: 'Matchmaking unavailable' }, { status: 500, statusText: 'Server Error' });

    await vi.waitFor(() => expect(store.status()).toBe('error'));
    expect(store.error()).toBe('Could not load people.');
    expect(() => store.people()).not.toThrow();
    expect(store.people()).toEqual([]);

    store.refresh();
    TestBed.tick();
    http.expectOne('/api/v1/users/matchmaking?size=24').flush({
      content: [{ id: 'p-1', username: 'kenji', displayName: 'Kenji', nativeLanguage: 'ja', followedByMe: false }],
      hasNext: false,
      nextAfterCreatedAt: null,
      nextAfterId: null,
    });

    await vi.waitFor(() => expect(store.status()).toBe('resolved'));
    expect(store.people().map((p) => p.displayName)).toEqual(['Kenji']);
    http.verify();
  });
});
