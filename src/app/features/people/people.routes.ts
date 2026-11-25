import { Routes } from '@angular/router';

export const PEOPLE_ROUTES: Routes = [
  {
    path: '',
    title: 'People',
    loadComponent: () => import('./pages/people-page/people-page').then((m) => m.PeoplePage),
  },
];
