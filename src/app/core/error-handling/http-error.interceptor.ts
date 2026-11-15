import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { loginUrl } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';

/**
 * An expired or revoked token (401 while signed in) ends the session and returns to sign-in.
 * Every error still reaches the caller, which decides what to show.
 */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && auth.isAuthenticated()) {
        auth.signOut();
        void router.navigateByUrl(loginUrl(router, router.url));
      }
      return throwError(() => error);
    }),
  );
};
