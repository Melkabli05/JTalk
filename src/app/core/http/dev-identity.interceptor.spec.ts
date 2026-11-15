import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DEV_IDENTITY } from '../auth/dev-identity.token';
import { devIdentityInterceptor } from './dev-identity.interceptor';

describe('devIdentityInterceptor', () => {
  function setup(devMode: boolean) {
    localStorage.clear();
    localStorage.setItem(
      'jtalk:profile',
      JSON.stringify({ id: 'm-1', name: 'Mona', nativeLanguage: 'ar', learning: 'en' }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([devIdentityInterceptor])),
        provideHttpClientTesting(),
        { provide: DEV_IDENTITY, useValue: devMode },
      ],
    });
    return TestBed.inject(HttpTestingController);
  }

  it('names the caller on requests to our API', () => {
    const http = setup(true);

    TestBed.inject(HttpClient).get('/api/v1/voice-rooms').subscribe();

    expect(http.expectOne('/api/v1/voice-rooms').request.headers.get('X-User-Id')).toBe('m-1');
  });

  it('keeps the header off requests to anyone else', () => {
    const http = setup(true);

    TestBed.inject(HttpClient).get('https://example.com/data').subscribe();

    expect(http.expectOne('https://example.com/data').request.headers.has('X-User-Id')).toBe(false);
  });

  it('sends no header outside a development build', () => {
    const http = setup(false);

    TestBed.inject(HttpClient).get('/api/v1/voice-rooms').subscribe();

    expect(http.expectOne('/api/v1/voice-rooms').request.headers.has('X-User-Id')).toBe(false);
  });
});
