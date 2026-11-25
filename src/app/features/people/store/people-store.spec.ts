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
    await vi.waitFor(() => expect(store.people().map((person) => person.name)).toEqual(['Partner']));
    expect(store.people()[0]?.followedByMe).toBe(true);

    store.query.set('am');
    TestBed.tick();
    const oldRequest = await vi.waitFor(() => http.expectOne('/api/v1/users/search?q=am&size=30'), { timeout: 2000 });
    store.query.set('amira');
    TestBed.tick();
    expect(oldRequest.cancelled).toBe(true);

    const request = await vi.waitFor(() => http.expectOne('/api/v1/users/search?q=amira&size=30'), { timeout: 2000 });
    request.flush([{ id: 'search', username: 'amira', displayName: 'Amira', nativeLanguage: 'ar', followedByMe: false }]);
    await vi.waitFor(() => expect(store.people().map((person) => person.name)).toEqual(['Amira']));
    expect(store.people()[0]?.followedByMe).toBe(false);
    expect(store.hasMore()).toBe(false);

    store.query.set('');
    TestBed.tick();
    expect(store.people().map((person) => person.name)).toEqual(['Partner']);
    expect(store.hasMore()).toBe(true);
    store.loadMore();
    TestBed.tick();
    http.expectOne('/api/v1/users/matchmaking?size=24&afterCreatedAt=date&afterId=match').flush({
      content: [{ ...partner, id: 'second', displayName: 'Second partner' }],
      hasNext: false, nextAfterCreatedAt: null, nextAfterId: null,
    });
    await vi.waitFor(() => expect(store.people().map(person => person.name)).toEqual(['Partner', 'Second partner']));
    expect(store.hasMore()).toBe(false);

    signedIn.set(false);
    TestBed.tick();
    expect(store.people()).toEqual([]);
    http.verify();
  });
});
