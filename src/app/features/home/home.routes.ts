import { Routes } from '@angular/router';

/** The page a visitor who is not signed in sees at the front address. */
export const HOME_ROUTES: Routes = [
  {
    path: '',
    title: 'Practise a language by talking',
    loadComponent: () => import('./pages/home-page/home-page.component'),
  },
];
