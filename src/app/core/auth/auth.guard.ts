import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

/** `/login?returnUrl=...`: where anonymous users and expired sessions go (the login page reads `returnUrl`). */
export function loginUrl(router: Router, returnUrl: string): UrlTree {
  return router.createUrlTree(['/login'], { queryParams: { returnUrl } });
}

/**
 * Client-side convenience only: the API must enforce authorization too.
 * Redirects anonymous users to the sign-in page, remembering where they were going.
 */
export const authGuard: CanActivateFn = (_route, state) =>
  inject(AuthService).isAuthenticated() || loginUrl(inject(Router), state.url);

/** The opposite: signed-in users have no business on the sign-in or register pages, so send them home. */
export const guestGuard: CanActivateFn = () =>
  !inject(AuthService).isAuthenticated() || inject(Router).createUrlTree(['/']);
