import { httpErrorInterceptor } from '../http/http-error.interceptor';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '@auth0/auth0-angular';
import { lastValueFrom, from, throwError } from 'rxjs';
import { vi } from 'vitest';
import { RoomsApi } from '../../features/rooms/data-access/rooms-api';
import { roomFeedTransport } from '../http/room-feed-transport';
import { authBearerInterceptor } from './auth-bearer.interceptor';

describe('authenticated HTTP requests', () => {
  const token = vi.fn(() => from(['test-token']));

  beforeEach(() => {
    token.mockReset().mockReturnValue(from(['test-token']));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([httpErrorInterceptor, authBearerInterceptor, roomFeedTransport]),
        ),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { isAuthenticated$: from([true]), getAccessTokenSilently: token },
        },
      ],
    });
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('authenticates the room feed and releases the request on unsubscribe', () => {
    const stream = TestBed.inject(RoomsApi)
      .roomFeed({ activity: vi.fn(), disconnected: vi.fn() })
      .subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/v1/voice-rooms/feed');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    expect(request.request.headers.get('Accept')).toBe('text/event-stream');
    stream.unsubscribe();
    expect(request.cancelled).toBe(true);
  });

  it('delivers a failed authenticated write exactly once', async () => {
    const url = '/api/v1/voice-rooms';
    const result = lastValueFrom(TestBed.inject(HttpClient).post(url, { title: 'Practice' }));
    const request = TestBed.inject(HttpTestingController).expectOne(url);
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({ detail: 'Room limit reached' }, { status: 409, statusText: 'Conflict' });
    await expect(result).rejects.toMatchObject({ status: 409 });
  });

  it('propagates a token acquisition failure before sending the request', async () => {
    token.mockReturnValueOnce(throwError(() => new Error('login required')));
    await expect(lastValueFrom(TestBed.inject(HttpClient).get('/api/v1/users/me'))).rejects.toThrow(
      'login required',
    );
  });

  it('leaves public avatar and external requests anonymous', async () => {
    for (const url of ['/api/v1/users/user-id/avatar/2', 'https://example.org/api/profile']) {
      const result = lastValueFrom(TestBed.inject(HttpClient).get(url));
      const request = TestBed.inject(HttpTestingController).expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({});
      await result;
    }
    expect(token).not.toHaveBeenCalled();
  });
});
