import { httpErrorInterceptor } from '../http/http-error.interceptor';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '@auth0/auth0-angular';
import { from } from 'rxjs';
import { IdentityStore } from './identity';

describe('IdentityStore profile edits', () => {
  const flushResources = async (): Promise<void> => {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            isLoading$: from([false]),
            isAuthenticated$: from([true]),
            user$: from([null]),
            error$: from([null]),
          },
        },
      ],
    });
  });

  it('preserves a regional native language and an empty learning list when editing the bio', async () => {
    const identity = TestBed.inject(IdentityStore);
    const http = TestBed.inject(HttpTestingController);
    const profile = {
      id: 'person',
      username: 'person',
      displayName: 'Person',
      nativeLanguage: 'pt-BR',
      nativeLanguages: ['pt-BR'],
      learningLanguages: [],
      createdAt: '2026-01-01T00:00:00Z',
    };
    identity.setProfile({ ...profile, bio: null, avatarUrl: null, countryCode: null });

    const saving = identity.saveProfile({
      displayName: 'Person',
      username: 'person',
      nativeLanguage: 'pt',
      learningLanguage: null,
      countryCode: null,
      bio: 'Updated bio',
    });
    const request = http.expectOne({ method: 'PATCH', url: '/api/v1/users/me' });
    expect(request.request.body).toEqual({
      bio: 'Updated bio',
    });
    request.flush({ ...profile, bio: 'Updated bio' });
    expect((await saving).ok).toBe(true);
    expect(identity.userDirectory().get('person')?.displayName).toBe('Person');

    identity.updateCachedAvatar('person', '/api/v1/users/person/avatar/42');
    expect(identity.me()?.avatarUrl).toBe('/api/v1/users/person/avatar/42');
    expect(identity.userDirectory().get('person')?.avatarUrl).toBe('/api/v1/users/person/avatar/42');
    http.verify();
  });

  it('starts onboarding only for the user service missing-profile problem', async () => {
    const identity = TestBed.inject(IdentityStore);
    const http = TestBed.inject(HttpTestingController);
    const url = '/api/v1/users/me';
    await flushResources();
    http.expectOne(url).flush('Not found', { status: 404, statusText: 'Not Found' });
    await flushResources();
    expect(identity.profileStatus()).toBe('error');

    identity.loadMe();
    await flushResources();
    http
      .expectOne(url)
      .flush(
        { type: 'urn:jtalk:user:problem:user-not-found' },
        { status: 404, statusText: 'Not Found' },
      );
    await flushResources();
    expect(identity.needsOnboarding()).toBe(true);
    http.verify();
  });

  it('recovers the existing profile when another session completes onboarding first', async () => {
    const identity = TestBed.inject(IdentityStore);
    const http = TestBed.inject(HttpTestingController);
    const url = '/api/v1/users/me';
    await flushResources();
    http
      .expectOne({ method: 'GET', url })
      .flush(
        { type: 'urn:jtalk:user:problem:user-not-found' },
        { status: 404, statusText: 'Not Found' },
      );
    await flushResources();
    expect(identity.needsOnboarding()).toBe(true);

    const saving = identity.saveProfile({
      displayName: 'Person',
      username: '',
      nativeLanguage: 'en',
      learningLanguage: 'fr',
      countryCode: null,
      bio: '',
    });
    http
      .expectOne({ method: 'POST', url })
      .flush(
        {
          type: 'urn:jtalk:user:problem:profile-already-exists',
          detail: 'You already have a profile',
        },
        { status: 409, statusText: 'Conflict' },
      );
    expect((await saving).ok).toBe(false);
    await flushResources();
    http.expectOne({ method: 'GET', url }).flush({
      id: 'person',
      username: 'existing',
      displayName: 'Person',
      nativeLanguage: 'en',
      nativeLanguages: ['en'],
      learningLanguages: [],
      createdAt: '2026-01-01T00:00:00Z',
      socialStats: {
        followerCount: 0,
        followingCount: 0,
        followedByMe: false,
        followsMe: false,
      },
    });
    await flushResources();
    expect(identity.me()?.username).toBe('existing');
    expect(identity.hasProfile()).toBe(true);
    expect(identity.socialStats()?.followerCount).toBe(0);
    http.verify();
  });

  it('reads socialStats from /me, keeps counts during refresh, and preserves them across PATCH saves', async () => {
    const identity = TestBed.inject(IdentityStore);
    const http = TestBed.inject(HttpTestingController);
    const stats = {
      followerCount: 7,
      followingCount: 3,
      followedByMe: false,
      followsMe: false,
    };
    const profile = {
      id: 'first',
      username: 'first',
      displayName: 'First',
      nativeLanguage: 'en',
      nativeLanguages: ['en'],
      learningLanguages: [],
      createdAt: '2026-01-01T00:00:00Z',
      socialStats: stats,
    };
    await flushResources();
    http.expectOne('/api/v1/users/me').flush(profile);
    await flushResources();
    expect(identity.socialStats()?.followerCount).toBe(7);

    const saving = identity.saveProfile({
      displayName: 'First Updated',
      username: 'first',
      nativeLanguage: 'en',
      learningLanguage: null,
      countryCode: null,
      bio: '',
    });
    http.expectOne({ method: 'PATCH', url: '/api/v1/users/me' }).flush({
      id: 'first',
      username: 'first',
      displayName: 'First Updated',
      nativeLanguage: 'en',
      nativeLanguages: ['en'],
      learningLanguages: [],
      createdAt: '2026-01-01T00:00:00Z',
    });
    expect((await saving).ok).toBe(true);
    expect(identity.socialStats()?.followerCount).toBe(7);

    identity.refreshSocialStats();
    TestBed.tick();
    const refresh = http.expectOne('/api/v1/users/me');
    expect(identity.socialStats()?.followerCount).toBe(7);
    refresh.flush({
      ...profile,
      displayName: 'First Updated',
      socialStats: { ...stats, followerCount: 9 },
    });
    await flushResources();
    expect(identity.socialStats()?.followerCount).toBe(9);
    http.verify();
  });
});
