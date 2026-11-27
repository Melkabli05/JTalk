import { Routes } from '@angular/router';
import { HomeStore } from './store/home.store';

export const HOME_ROUTES: Routes = [
  {
    path: '',
    title: 'Practise a language by talking',
    providers: [HomeStore],
    loadComponent: () => import('./pages/home-page/home-page').then((m) => m.HomePage),
  },
];
