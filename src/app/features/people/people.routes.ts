import { Routes } from '@angular/router';
import { PeopleFacade } from './store/people.facade';

export const PEOPLE_ROUTES: Routes = [
  {
    path: '',
    title: 'People',
    providers: [PeopleFacade],
    loadComponent: () => import('./pages/people-page/people-page').then((m) => m.PeoplePage),
  },
];
