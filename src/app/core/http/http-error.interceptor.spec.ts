import {
  HttpClient,
  HttpErrorResponse,
  httpResource,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { lastValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { errorMessage, httpErrorInterceptor } from './http-error.interceptor';
import { SessionExpiryHandler } from './session-expiry';
import { countryNameFor, languageNameFor } from '../utils/language-codes';

describe('httpErrorInterceptor', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('rejects with the normalized problem and preserves the original response', async () => {
    const result = lastValueFrom(TestBed.inject(HttpClient).get('/api/profile'));
    const body = JSON.stringify({
      type: 'urn:jtalk:user:problem:user-not-found',
      detail: 'User 550e8400-e29b-41d4-a716-446655440000 was not found',
    });
    TestBed.inject(HttpTestingController)
      .expectOne('/api/profile')
      .flush(body, { status: 404, statusText: 'Not Found' });
    await expect(result).rejects.toMatchObject({
      type: 'urn:jtalk:user:problem:user-not-found',
      message: 'Profile not found.',
      status: 404,
      cause: expect.objectContaining({ error: body, url: '/api/profile' }),
    });
  });

  it.each([
    ['urn:jtalk:user:problem:username-taken', 409, "The username 'mona' is taken"],
    ['urn:jtalk:live-communication:problem:stage-full', 409, 'All 8 stage seats are taken'],
    [
      'urn:jtalk:live-communication:problem:not-room-host',
      403,
      'Only the room host can kick participants',
    ],
    ['urn:jtalk:user:problem:cannot-follow-self', 422, 'Users cannot follow themselves'],
  ])('passes through backend RFC 9457 detail for %s', async (type, status, detail) => {
    const result = lastValueFrom(TestBed.inject(HttpClient).post('/api/action', {}));
    TestBed.inject(HttpTestingController)
      .expectOne('/api/action')
      .flush({ type, title: 'Error', status, detail }, { status, statusText: 'Error' });
    await expect(result).rejects.toMatchObject({ type, status, message: detail });
  });

  it('exposes a normalized failure through httpResource and recovers on reload', async () => {
    const resource = TestBed.runInInjectionContext(() =>
      httpResource<string[]>(() => '/api/users'),
    );
    const http = TestBed.inject(HttpTestingController);
    TestBed.tick();
    http
      .expectOne('/api/users')
      .flush({ message: 'Invalid search' }, { status: 400, statusText: 'Bad Request' });
    await vi.waitFor(() => expect(resource.status()).toBe('error'));
    expect(resource.error()).toMatchObject({ status: 400, message: 'Invalid search' });

    resource.reload();
    TestBed.tick();
    http.expectOne('/api/users').flush(['person']);
    await vi.waitFor(() => expect(resource.value()).toEqual(['person']));
  });

  it('includes the server retry delay', async () => {
    const result = lastValueFrom(TestBed.inject(HttpClient).get('/api/profile'));
    TestBed.inject(HttpTestingController)
      .expectOne('/api/profile')
      .flush(null, {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Retry-After': '15' },
      });
    await expect(result).rejects.toThrow('Try again in 15s');
  });

  it('preserves backend RFC 9457 detail on 429 when Retry-After is absent', async () => {
    const result = lastValueFrom(
      TestBed.inject(HttpClient).post('/api/v1/voice-rooms/1/reactions', {}),
    );
    TestBed.inject(HttpTestingController).expectOne('/api/v1/voice-rooms/1/reactions').flush(
      {
        type: 'urn:jtalk:live-communication:problem:reacting-too-fast',
        status: 429,
        detail: 'Wait a moment before reacting again',
      },
      { status: 429, statusText: 'Too Many Requests' },
    );
    await expect(result).rejects.toMatchObject({
      status: 429,
      message: 'Wait a moment before reacting again',
    });
  });

  it.each([
    ['error', 'Unable to reach JTalk'],
    ['timeout', 'The request timed out'],
  ])('normalizes a network %s', async (event, message) => {
    const result = lastValueFrom(TestBed.inject(HttpClient).get('/api/profile'));
    TestBed.inject(HttpTestingController).expectOne('/api/profile').error(new ProgressEvent(event));
    await expect(result).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining(message),
      cause: expect.any(HttpErrorResponse),
    });
  });

  it.each([
    [
      'urn:jtalk:user:problem:no-learning-language',
      422,
      'Add a language you are learning, or say which one to match with (learningLang)',
      'Add a language you are learning on your profile to see matches.',
    ],
    [
      'urn:jtalk:live-communication:problem:not-a-participant',
      409,
      'User 550e8400-e29b-41d4-a716-446655440000 is not in this room',
      'That person is no longer in this room.',
    ],
    [
      'urn:jtalk:live-communication:problem:comment-not-found',
      404,
      "Comment 550e8400-e29b-41d4-a716-446655440000 is not in this room's chat",
      'That message is no longer in this room.',
    ],
    [
      'urn:jtalk:live-communication:problem:media-server-unreachable',
      503,
      'LiveKit unreachable while trying to createRoom',
      'Voice audio is temporarily unavailable. Please try again shortly.',
    ],
    [
      'urn:jtalk:live-communication:problem:not-in-room',
      403,
      '550e8400-e29b-41d4-a716-446655440000 has not joined room room-1',
      'You are not currently in this room. Rejoin to continue.',
    ],
  ])('sanitizes technical or UUID-bearing detail for %s', async (type, status, detail, expected) => {
    const result = lastValueFrom(TestBed.inject(HttpClient).post('/api/action', {}));
    TestBed.inject(HttpTestingController)
      .expectOne('/api/action')
      .flush({ type, title: 'Error', status, detail }, { status, statusText: 'Error' });
    await expect(result).rejects.toMatchObject({ type, status, message: expected });
  });

  it('triggers session expiry when an authenticated request returns 401', async () => {
    const sessionExpiry = TestBed.inject(SessionExpiryHandler);
    const handleSpy = vi.spyOn(sessionExpiry, 'handle');
    const result = lastValueFrom(
      TestBed.inject(HttpClient).get('/api/v1/users/me', {
        headers: { Authorization: 'Bearer expired-token' },
      }),
    );
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/users/me')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(handleSpy).toHaveBeenCalledTimes(1);
  });

  it('reports an offline message when navigator.onLine is false on network error', async () => {
    const onlineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      const result = lastValueFrom(TestBed.inject(HttpClient).get('/api/profile'));
      TestBed.inject(HttpTestingController)
        .expectOne('/api/profile')
        .error(new ProgressEvent('error'));
      await expect(result).rejects.toMatchObject({
        status: 0,
        message: 'You appear to be offline. Check your connection and try again.',
      });
    } finally {
      onlineSpy.mockRestore();
    }
  });

  it('hides technical SDK and runtime error messages behind friendly fallbacks', () => {
    expect(
      errorMessage(
        new Error(
          "Missing Refresh Token (audience: 'https://api.jtalk.app', scope: 'openid profile email offline_access')",
        ),
        'Could not load your profile.',
      ),
    ).toBe('Your session expired. Please sign in again.');

    expect(
      errorMessage(new Error('TypeError: Cannot read properties of undefined'), 'Could not save.'),
    ).toBe('Could not save.');
  });
});

describe('Language codes', () => {
  it('maps ISO codes to display names', () => {
    expect(languageNameFor('ar')).toBe('Arabic');
    expect(countryNameFor('JP')).toBe('Japan');
  });
});
