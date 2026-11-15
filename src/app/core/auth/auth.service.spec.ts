import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('starts signed out', () => {
    const auth = TestBed.inject(AuthService);
    expect(auth.token()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('posts credentials and starts a session with the returned token', () => {
    const auth = TestBed.inject(AuthService);
    const done = vi.fn();
    auth.signIn({ email: 'a@b.co', password: 'secret' }).subscribe(done);

    const request = http.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'a@b.co', password: 'secret' });
    expect(auth.isAuthenticated()).toBe(false); // nothing happens until the API answers
    request.flush({ token: 'jwt' });

    expect(done).toHaveBeenCalledOnce();
    expect(auth.token()).toBe('jwt');
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('survives a reload within the same tab', () => {
    TestBed.inject(AuthService).signIn({ email: 'a@b.co', password: 'secret' }).subscribe();
    http.expectOne('/api/auth/login').flush({ token: 'jwt' });

    TestBed.resetTestingModule();
    expect(TestBed.inject(AuthService).token()).toBe('jwt');
  });

  it('leaves the session untouched and reports the error when sign-in fails', () => {
    const auth = TestBed.inject(AuthService);
    const failed = vi.fn();
    auth.signIn({ email: 'a@b.co', password: 'nope' }).subscribe({ error: failed });

    http.expectOne('/api/auth/login').flush('denied', { status: 401, statusText: 'Unauthorized' });

    expect(failed).toHaveBeenCalledOnce();
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('clears the session, including storage, on sign-out', () => {
    sessionStorage.setItem('jtalk:token', 'jwt');
    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(true);

    auth.signOut();

    expect(auth.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem('jtalk:token')).toBeNull();
  });

  it('registers without starting a session', () => {
    const auth = TestBed.inject(AuthService);
    const done = vi.fn();
    auth.register({ email: 'a@b.co', password: 'correct horse battery' }).subscribe(done);

    const request = http.expectOne('/api/auth/register');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'a@b.co', password: 'correct horse battery' });
    request.flush(null, { status: 202, statusText: 'Accepted' });

    expect(done).toHaveBeenCalledOnce();
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('requests a reset link and sets a new password with the token', () => {
    const auth = TestBed.inject(AuthService);
    auth.requestPasswordReset('a@b.co').subscribe();
    const forgot = http.expectOne('/api/auth/forgot-password');
    expect(forgot.request.body).toEqual({ email: 'a@b.co' });
    forgot.flush(null, { status: 202, statusText: 'Accepted' });

    auth.resetPassword('tok', 'correct horse battery').subscribe();
    const reset = http.expectOne('/api/auth/reset-password');
    expect(reset.request.body).toEqual({ token: 'tok', password: 'correct horse battery' });
    reset.flush(null, { status: 204, statusText: 'No Content' });
  });
});
