import { Routes } from '@angular/router';
import { msg } from '@shared/utils/i18n/msg';

export const HOME_ROUTES: Routes = [
  {
    path: '',
    title: msg('Home'),
    loadComponent: () => import('./pages/home-page/home-page.component'),
  },
];
