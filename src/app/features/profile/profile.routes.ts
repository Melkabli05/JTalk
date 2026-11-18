import { Routes } from '@angular/router';
import { msg } from '@shared/utils/i18n/msg';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    title: msg('Your profile'),
    loadComponent: () => import('./pages/profile-page/profile-page.component'),
  },
];
