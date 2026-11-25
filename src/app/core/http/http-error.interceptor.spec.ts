import { HttpClient, HttpErrorResponse, httpResource, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { lastValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { httpErrorInterceptor } from './http-error.interceptor';
import { countryCodeFor, countryNameFor, languageCodeFor, languageNameFor } from '../utils/language-codes';
import { isSafeAvatarUrl, sanitizeAvatarUrl } from '../utils/safe-url';

describe('httpErrorInterceptor', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [
    provideHttpClient(withInterceptors([httpErrorInterceptor])), provideHttpClientTesting(),
  ] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('rejects with the normalized problem and preserves the original response', async () => {
    const result = lastValueFrom(TestBed.inject(HttpClient).get('/api/profile'));
    const body = JSON.stringify({
      type: 'urn:jtalk:user:problem:user-not-found',
      detail: 'User 550e8400-e29b-41d4-a716-446655440000 was not found',
    });
    TestBed.inject(HttpTestingController).expectOne('/api/profile').flush(body, { status: 404, statusText: 'Not Found' });
    await expect(result).rejects.toMatchObject({
      type: 'urn:jtalk:user:problem:user-not-found', message: 'Profile not found.', status: 404,
      cause: expect.objectContaining({ error: body, url: '/api/profile' }),
    });
  });

  it.each([
    ['urn:jtalk:user:problem:username-taken', 409, "The username 'mona' is taken"],
    ['urn:jtalk:live-communication:problem:stage-full', 409, 'All 8 stage seats are taken'],
    ['urn:jtalk:live-communication:problem:not-room-host', 403, 'Only the room host can kick participants'],
    ['urn:jtalk:user:problem:cannot-follow-self', 422, 'Users cannot follow themselves'],
  ])('passes through backend RFC 9457 detail for %s', async (type, status, detail) => {
    const result = lastValueFrom(TestBed.inject(HttpClient).post('/api/action', {}));
    TestBed.inject(HttpTestingController)
      .expectOne('/api/action')
      .flush({ type, title: 'Error', status, detail }, { status, statusText: 'Error' });
    await expect(result).rejects.toMatchObject({ type, status, message: detail });
  });

  it('exposes a normalized failure through httpResource and recovers on reload', async () => {
    const resource = TestBed.runInInjectionContext(() => httpResource<string[]>(() => '/api/users'));
    const http = TestBed.inject(HttpTestingController);
    TestBed.tick();
    http.expectOne('/api/users').flush({ message: 'Invalid search' }, { status: 400, statusText: 'Bad Request' });
    await vi.waitFor(() => expect(resource.status()).toBe('error'));
    expect(resource.error()).toMatchObject({ status: 400, message: 'Invalid search' });

    resource.reload();
    TestBed.tick();
    http.expectOne('/api/users').flush(['person']);
    await vi.waitFor(() => expect(resource.value()).toEqual(['person']));
  });

  it('includes the server retry delay', async () => {
    const result = lastValueFrom(TestBed.inject(HttpClient).get('/api/profile'));
    TestBed.inject(HttpTestingController).expectOne('/api/profile').flush(null, {
      status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '15' },
    });
    await expect(result).rejects.toThrow('Try again in 15s');
  });

  it.each([
    ['error', 'Unable to reach JTalk'],
    ['timeout', 'The request timed out'],
  ])('normalizes a network %s', async (event, message) => {
    const result = lastValueFrom(TestBed.inject(HttpClient).get('/api/profile'));
    TestBed.inject(HttpTestingController).expectOne('/api/profile').error(new ProgressEvent(event));
    await expect(result).rejects.toMatchObject({
      status: 0, message: expect.stringContaining(message), cause: expect.any(HttpErrorResponse),
    });
  });
});

describe('Language codes and avatar URLs', () => {
  it('maps language names and ISO codes bidirectionally', () => {
    expect(languageCodeFor('Japanese')).toBe('ja');
    expect(languageCodeFor('es-MX')).toBe('es');
    expect(languageNameFor('ar')).toBe('Arabic');
    expect(countryCodeFor('Morocco')).toBe('MA');
    expect(countryNameFor('JP')).toBe('Japan');
  });

  it('rejects unsafe avatar URLs and accepts https and safe relative paths', () => {
    expect(isSafeAvatarUrl('https://cdn.example.com/avatar.jpg')).toBe(true);
    expect(isSafeAvatarUrl('/api/v1/users/123/avatar/1')).toBe(true);
    expect(sanitizeAvatarUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeAvatarUrl('//evil.example/x.png')).toBeNull();
    expect(sanitizeAvatarUrl('/api/../secret')).toBeNull();
  });
});
