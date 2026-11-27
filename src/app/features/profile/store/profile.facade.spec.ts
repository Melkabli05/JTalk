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

function makeProfile(overrides: Partial<UserProfileResponse> = {}): UserProfileResponse {
  return {
    id: 'me-1',
    username: 'yuki',
    displayName: 'Yuki',
    bio: '',
    avatarUrl: null,
    countryCode: 'JP',
    nativeLanguage: 'ja',
    nativeLanguages: ['ja'],
    learningLanguages: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('ProfileFacade', () => {
  const meSignal = signal<UserProfileResponse | null>(makeProfile());
  const toastSpy = { show: vi.fn() };
  const identityMock = {
    me: meSignal,
    socialStats: signal(undefined),
    profileError: signal<string | null>(null),
    hasProfile: signal(true),
    needsOnboarding: signal(false),
    savingProfile: signal(false),
    loadMe: vi.fn(),
    applyLanguageMatrix: vi.fn(),
    saveProfile: vi.fn(),
    deleteAccount: vi.fn(),
  };
  const roomStoreMock = {
    signOut: vi.fn(),
    rememberRoom: vi.fn(),
  };

  beforeEach(() => {
    meSignal.set(makeProfile());
    toastSpy.show.mockReset();
    identityMock.loadMe.mockReset();
    identityMock.applyLanguageMatrix.mockReset();
    identityMock.saveProfile.mockReset();
    identityMock.deleteAccount.mockReset();
    roomStoreMock.signOut.mockReset();
    roomStoreMock.rememberRoom.mockReset();

    TestBed.configureTestingModule({
      providers: [
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

  it('updates languages with pending flag and delegates deleteAccount', () => {
    const facade = TestBed.inject(ProfileFacade);
    const http = TestBed.inject(HttpTestingController);

    facade.changeLanguage('fr', 'LEARNING', 'BEGINNER');
    expect(facade.languageBusy()).toBe(true);
    const req = http.expectOne({ method: 'POST', url: '/api/v1/users/me/languages' });
    expect(req.request.body).toEqual({
      languageCode: 'fr',
      languageType: 'LEARNING',
      proficiencyLevel: 'BEGINNER',
    });
    const matrix = {
      userId: 'me-1',
      nativeLanguages: ['ja'],
      learningLanguages: [{ languageCode: 'fr', proficiencyLevel: 'BEGINNER' }],
    };
    req.flush(matrix);
    expect(facade.languageBusy()).toBe(false);
    expect(identityMock.applyLanguageMatrix).toHaveBeenCalledWith(matrix);

    identityMock.deleteAccount.mockImplementation((onDone?: (res: { ok: boolean }) => void) => {
      onDone?.({ ok: true });
    });
    facade.deleteAccount();
    expect(roomStoreMock.rememberRoom).toHaveBeenCalledWith(null);
    http.verify();
  });
});
