import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { authGuard, guestGuard } from './auth.guard';

describe('authGuard', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  const run = () =>
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/profile' } as RouterStateSnapshot),
    );

  it('allows signed-in users', () => {
    sessionStorage.setItem('jtalk:token', 'jwt');
    expect(run()).toBe(true);
  });

  it('redirects anonymous users to /login and remembers where they were going', () => {
    const result = run();

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
      '/login?returnUrl=%2Fprofile',
    );
  });
});

describe('guestGuard', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  const run = () =>
    TestBed.runInInjectionContext(() =>
      guestGuard({} as ActivatedRouteSnapshot, { url: '/login' } as RouterStateSnapshot),
    );

  it('lets anonymous users see the page', () => {
    expect(run()).toBe(true);
  });

  it('sends signed-in users home', () => {
    sessionStorage.setItem('jtalk:token', 'jwt');
    const result = run();

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
  });
});
