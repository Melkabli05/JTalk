import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { catchError, combineLatest, filter, map, of, take } from 'rxjs';
import { sanitizeReturnUrl } from './auth.utils';

/**
 * Protects authenticated app views (`/rooms`, `/room/:id`, `/people`, `/profile`).
 * Waits for Auth0 session hydration on the browser before deciding. Unauthenticated
 * visitors are redirected to `/` where they can sign in via Auth0.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const auth = inject(AuthService, { optional: true });
  const router = inject(Router);
  if (!auth) {
    return router.createUrlTree(['/']);
  }

  const nextUrl = sanitizeReturnUrl(state.url, '');

  return combineLatest([auth.isLoading$, auth.isAuthenticated$]).pipe(
    filter(([loading]) => !loading),
    take(1),
    map(([, authenticated]) => {
      if (authenticated) {
        return true;
      }
      return router.createUrlTree(['/'], {
        queryParams: nextUrl ? { next: nextUrl } : undefined,
      });
    }),
    catchError(() =>
      of(
        router.createUrlTree(['/'], {
          queryParams: nextUrl ? { next: nextUrl } : undefined,
        }),
      ),
    ),
  );
};
