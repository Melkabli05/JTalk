import { Routes } from '@angular/router';
import { guestGuard } from './auth.guard';
import { msg } from '@shared/utils/i18n/msg';

const guestOnly = { canActivate: [guestGuard] };

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
