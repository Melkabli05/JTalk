import { isPlatformBrowser } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { switchMap, take } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_BASE_URL } from '../http/api-base-url.token';

const PUBLIC_AVATAR_PATH_RE = /\/v1\/users\/[^/]+\/avatar\/[^/]+$/;

/**
 * Attaches the Auth0 Bearer access token strictly to same-origin JTalk `/api/*`
 * requests (never leaking tokens to third-party origins) and skips public avatar
 * image GET requests and server-side rendering.
 */
export const authBearerInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) {
    return next(req);
  }

  const apiBase = inject(API_BASE_URL);
  const isApiRequest =
    req.url.startsWith(`${apiBase}/`) ||
    req.url === apiBase ||
    req.url.startsWith('/api/');

  if (!isApiRequest || (req.method === 'GET' && PUBLIC_AVATAR_PATH_RE.test(req.url))) {
    return next(req);
  }

  const auth = inject(AuthService, { optional: true });
  if (!auth) {
    return next(req);
  }

  return auth.isAuthenticated$.pipe(
    take(1),
    switchMap((authenticated) => {
      if (!authenticated) {
        return next(req);
      }
      return auth.getAccessTokenSilently({
        authorizationParams: { audience: environment.auth0.audience },
      }).pipe(
        switchMap((token) =>
          next(
            req.clone({
              setHeaders: {
                Authorization: `Bearer ${token}`,
              },
            }),
          ),
        ),
      );
    }),
  );
};
