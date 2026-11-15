import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from './api-base-url.token';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });

  const http = () => TestBed.inject(HttpClient);
  const backend = () => TestBed.inject(HttpTestingController);
  const api = () => TestBed.inject(API_BASE_URL);

  it('adds the bearer token to API requests', () => {
    sessionStorage.setItem('jtalk:token', 'jwt');
    http().get(`${api()}/users`).subscribe();

    expect(backend().expectOne('/api/users').request.headers.get('Authorization')).toBe(
      'Bearer jwt',
    );
  });

  it('never sends the token to other origins', () => {
    sessionStorage.setItem('jtalk:token', 'jwt');
    http().get('https://example.com/x').subscribe();

    expect(backend().expectOne('https://example.com/x').request.headers.has('Authorization')).toBe(
      false,
    );
  });

  it('does not match a look-alike path that merely starts with the base URL text', () => {
    sessionStorage.setItem('jtalk:token', 'jwt');
    http().get('/apiary/users').subscribe();

    expect(backend().expectOne('/apiary/users').request.headers.has('Authorization')).toBe(false);
  });

  it('sends no header when signed out', () => {
    http().get(`${api()}/users`).subscribe();
    expect(backend().expectOne('/api/users').request.headers.has('Authorization')).toBe(false);
  });
});
