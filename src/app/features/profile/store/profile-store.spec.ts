import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { IdentityStore } from '../../../core/auth/identity';
import { ProfileStore } from './profile-store';

describe('ProfileStore', () => {
  it('loads paginated followers and unblocks accounts cleanly', async () => {
    const loadMe = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        ProfileStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: IdentityStore,
          useValue: {
            me: signal({
              id: 'me-1',
              username: 'amina',
              displayName: 'Amina',
              bio: null,
              avatarUrl: null,
              countryCode: null,
              nativeLanguage: 'ar',
              nativeLanguages: ['ar'],
              learningLanguages: [],
              createdAt: '2026-01-01T00:00:00Z',
            }),
            loadMe,
          },
        },
      ],
    });

    const store = TestBed.inject(ProfileStore);
    const http = TestBed.inject(HttpTestingController);

    const flushResources = async () => {
      TestBed.tick();
      await Promise.resolve();
      TestBed.tick();
    };

    store.loadConnections('followers');
    TestBed.tick();
    http.expectOne('/api/v1/users/me-1/followers?page=0&size=30').flush({
      content: [{ id: 'u-2', username: 'karim', displayName: 'Karim', nativeLanguage: 'en' }],
      page: 0,
      size: 30,
      total: 35,
    });
    await flushResources();
    expect(store.connections().map((u) => u.username)).toEqual(['karim']);
    expect(store.moreConnections()).toBe(true);

    store.loadConnections('followers', true);
    TestBed.tick();
    http.expectOne('/api/v1/users/me-1/followers?page=1&size=30').flush({
      content: [{ id: 'u-3', username: 'sara', displayName: 'Sara', nativeLanguage: 'fr' }],
      page: 1,
      size: 30,
      total: 35,
    });
    await flushResources();
    expect(store.connections().map((u) => u.username)).toEqual(['karim', 'sara']);
    expect(store.moreConnections()).toBe(false);

    const changing = store.changeLanguage('ja', 'LEARNING', 'INTERMEDIATE');
    const langReq = http.expectOne('/api/v1/users/me/languages');
    expect(langReq.request.body).toEqual({
      languageCode: 'ja',
      languageType: 'LEARNING',
      proficiencyLevel: 'INTERMEDIATE',
    });
    langReq.flush({
      userId: 'me-1',
      nativeLanguages: ['ar'],
      learningLanguages: [{ languageCode: 'ja', proficiencyLevel: 'INTERMEDIATE' }],
    });
    expect(await changing).toBeNull();
    expect(TestBed.inject(IdentityStore).me()?.learningLanguages[0]?.languageCode).toBe('ja');
    expect(loadMe).not.toHaveBeenCalled();
    http.verify();
  });
});
