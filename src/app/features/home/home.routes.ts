import { Routes } from '@angular/router';

export const HOME_ROUTES: Routes = [
  {
    path: '',
    title: 'Practise a language by talking',
    loadComponent: () => import('./pages/home-page/home-page').then((m) => m.HomePage),
  },
];
