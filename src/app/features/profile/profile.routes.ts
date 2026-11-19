import { Routes } from '@angular/router';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    title: 'Your profile',
    loadComponent: () => import('./pages/profile-page/profile-page.component'),
  },
];

export const PEOPLE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'People',
    loadComponent: () => import('./pages/people-page/people-page.component'),
  },
  {
    path: ':id',
    title: 'Profile',
    loadComponent: () => import('./pages/person-page/person-page.component'),
  },
];
