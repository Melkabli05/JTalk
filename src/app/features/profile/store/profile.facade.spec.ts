import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { UserProfileResponse } from '../../../core/auth/auth.models';
import { IdentityStore } from '../../../core/auth/identity';
import { ToastNotifier } from '../../../core/services/toast-notifier';
import { LiveRoomStore } from '../../room/store/live-room-store';
import { ProfileFacade } from './profile.facade';
import { ProfileStore } from './profile.store';

function makeProfile(overrides: Partial<UserProfileResponse> = {}): UserProfileResponse {
  return {
    id: 'me-1',
    username: 'yuki',
    displayName: 'Yuki',
    bio: '',
    avatarUrl: null,
    countryCode: 'JP',
    nativeLanguage: 'ja',
    nativeLanguages: ['ja', 'fr'],
    learningLanguages: [{ languageCode: 'en', proficiencyLevel: 'INTERMEDIATE' }],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('ProfileFacade', () => {
  const meSignal = signal<UserProfileResponse | null>(makeProfile());
  const toastSpy = { show: vi.fn() };
  const identityMock = {
    isAuthenticated: signal(true),
    isLoading: signal(false),
    userId: signal('me-1'),
    displayNameFallback: signal('Yuki'),
    userDirectory: signal(new Map()),
    me: meSignal,
    socialStats: signal(undefined),
    authUser: signal({ email: 'yuki@example.com' }),
    profileStatus: signal<'ready'>('ready'),
    meRetrying: signal(false),
    profileError: signal<string | null>(null),
    hasProfile: signal(true),
    needsOnboarding: signal(false),
    savingProfile: signal(false),
    deletingAccount: signal(false),
    loadMe: vi.fn(),
    setProfile: vi.fn(),
    patchMe: vi.fn(),
    applyLanguageMatrix: vi.fn(),
    saveProfile: vi.fn(),
    deleteAccount: vi.fn(),
  };
  const roomStoreMock = {
    roomId: signal(null),
    room: signal(null),
    practiseLangLabel: signal('English'),
    stage: {
      isHost: signal(false),
      isCurrentUserOnStage: signal(false),
      speakers: signal([]),
    },
    signOut: vi.fn(),
    rememberRoom: vi.fn(),
  };

  beforeEach(() => {
    meSignal.set(makeProfile());
    toastSpy.show.mockReset();
    identityMock.loadMe.mockReset();
    identityMock.setProfile.mockReset();
    identityMock.patchMe.mockReset();
    identityMock.applyLanguageMatrix.mockReset();
    identityMock.saveProfile.mockReset();
    identityMock.deleteAccount.mockReset();
    roomStoreMock.signOut.mockReset();
    roomStoreMock.rememberRoom.mockReset();

    TestBed.configureTestingModule({
      providers: [
        ProfileStore,
        ProfileFacade,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: IdentityStore, useValue: identityMock },
        { provide: LiveRoomStore, useValue: roomStoreMock },
        { provide: ToastNotifier, useValue: toastSpy },
      ],
    });
  });

  it('loads connections, handles errors, and recovers via retryConnections()', async () => {
    const facade = TestBed.inject(ProfileFacade);
    const http = TestBed.inject(HttpTestingController);

    expect(facade.connectionList()).toBeNull();
    expect(facade.connections()).toEqual([]);
    expect(facade.authEmail()).toBe('yuki@example.com');

    facade.loadConnections('followers');
    TestBed.tick();
    http
      .expectOne('/api/v1/users/me-1/followers?page=0&size=30')
      .flush({ message: 'Unavailable' }, { status: 500, statusText: 'Server Error' });

    await vi.waitFor(() => expect(facade.connectionsStatus()).toBe('error'));
    expect(facade.connectionsError()).toBe('Could not load accounts.');
    expect(() => facade.connections()).not.toThrow();

    facade.retryConnections();
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

    await vi.waitFor(() => expect(facade.connectionsStatus()).toBe('resolved'));
    expect(facade.connections().map((a) => a.displayName)).toEqual(['Amira']);
    http.verify();
  });

  it('updates languages, switches roles cleanly via DELETE+POST, promotes primary native, and delegates deleteAccount', () => {
    const facade = TestBed.inject(ProfileFacade);
    const http = TestBed.inject(HttpTestingController);

    // Add new learning language
    facade.changeLanguage('de', 'LEARNING', 'BEGINNER');
    expect(facade.languageBusy()).toBe(true);
    const addReq = http.expectOne({ method: 'POST', url: '/api/v1/users/me/languages' });
    expect(addReq.request.body).toEqual({
      languageCode: 'de',
      languageType: 'LEARNING',
      proficiencyLevel: 'BEGINNER',
    });
    const matrix = {
      userId: 'me-1',
      nativeLanguages: ['ja', 'fr'],
      learningLanguages: [
        { languageCode: 'en', proficiencyLevel: 'INTERMEDIATE' as const },
        { languageCode: 'de', proficiencyLevel: 'BEGINNER' as const },
      ],
    };
    addReq.flush(matrix);
    expect(facade.languageBusy()).toBe(false);
    expect(identityMock.applyLanguageMatrix).toHaveBeenCalledWith(matrix);

    // Switch existing learning language ('en') to NATIVE atomically via POST
    facade.changeLanguage('en', 'NATIVE');
    const switchReq = http.expectOne({ method: 'POST', url: '/api/v1/users/me/languages' });
    expect(switchReq.request.body).toEqual({
      languageCode: 'en',
      languageType: 'NATIVE',
    });
    switchReq.flush({ userId: 'me-1', nativeLanguages: ['ja', 'fr', 'en'], learningLanguages: [] });
    expect(facade.languageBusy()).toBe(false);

    // Promote secondary native ('fr') to primary native -> IdentityStore.patchMe
    identityMock.patchMe.mockImplementation((_patch, onDone?: (ok: boolean) => void) => {
      onDone?.(true);
    });
    facade.setPrimaryNativeLanguage('fr');
    expect(identityMock.patchMe).toHaveBeenCalledWith(
      { nativeLanguage: 'fr' },
      expect.any(Function),
    );

    identityMock.deleteAccount.mockImplementation((onDone?: (res: { ok: boolean }) => void) => {
      onDone?.({ ok: true });
    });
    facade.deleteAccount();
    expect(roomStoreMock.rememberRoom).toHaveBeenCalledWith(null);
    http.verify();
  });
});
