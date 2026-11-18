import { inject } from '@angular/core';
import type { CanMatchFn } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { map, take } from 'rxjs';

/**
 * Lets a route match only for someone who is not signed in: the public home page lives at the address the signed-in app also uses, and
 * this is what tells them apart. It waits for Auth0 to say who is there, so a signed-in person never sees the home page flash by.
 */
export const signedOutGuard: CanMatchFn = () =>
  inject(AuthService).isAuthenticated$.pipe(
    take(1),
    map((signedIn) => !signedIn),
  );
