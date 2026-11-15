import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { httpErrorInterceptor } from './http-error.interceptor';

describe('httpErrorInterceptor', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });

  const http = () => TestBed.inject(HttpClient);
  const backend = () => TestBed.inject(HttpTestingController);

  it('ends the session and returns to sign-in on 401 while signed in', () => {
    sessionStorage.setItem('jtalk:token', 'expired');
    const auth = TestBed.inject(AuthService);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    http()
      .get('/chats')
      .subscribe({ error: () => undefined });
    backend().expectOne('/chats').flush('', { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(String(navigate.mock.calls[0]?.[0])).toBe('/login?returnUrl=%2F');
  });

  it('does not redirect a 401 for someone who is not signed in', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    http()
      .post('/auth/login', {})
      .subscribe({ error: () => undefined });
    backend().expectOne('/auth/login').flush('', { status: 401, statusText: 'Unauthorized' });

    expect(navigate).not.toHaveBeenCalled();
  });

  it('still surfaces the error to the caller', () => {
    const failed = vi.fn();
    http().get('/chats').subscribe({ error: failed });
    backend().expectOne('/chats').flush('', { status: 500, statusText: 'Server Error' });

    expect(failed).toHaveBeenCalledOnce();
  });
});
