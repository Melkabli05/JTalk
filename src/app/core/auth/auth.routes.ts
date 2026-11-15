import { Routes } from '@angular/router';
import { guestGuard } from './auth.guard';
import { msg } from '@shared/utils/i18n/msg';

// A componentless parent route would be the tidier way to share the guard, but an empty-path parent
// also matches `/` and swallows it, so the guard is spread into each route instead.
const guestOnly = { canActivate: [guestGuard] };

/**
 * The account pages. They live outside the application shell (no navigation around a sign-in form) and
 * `app.routes.ts` spreads them next to the shell route. Signed-in users are sent home from all but
 * the reset page, which is opened from an emailed link.
 */
export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    title: msg('Sign in'),
    ...guestOnly,
    loadComponent: () => import('./pages/login-page/login-page.component'),
  },
  {
    path: 'register',
    title: msg('Create account'),
    ...guestOnly,
    loadComponent: () => import('./pages/register-page/register-page.component'),
  },
  {
    path: 'forgot-password',
    title: msg('Reset your password'),
    ...guestOnly,
    loadComponent: () => import('./pages/forgot-password-page/forgot-password-page.component'),
  },
  {
    path: 'reset-password',
    title: msg('Choose a new password'),
    loadComponent: () => import('./pages/reset-password-page/reset-password-page.component'),
  },
];
