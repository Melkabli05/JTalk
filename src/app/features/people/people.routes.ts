import { Routes } from '@angular/router';
import { PeopleFacade } from './store/people.facade';
import { PeopleStore } from './store/people.store';

export const PEOPLE_ROUTES: Routes = [
  {
    path: '',
    title: 'People',
    providers: [PeopleStore, PeopleFacade],
    loadComponent: () => import('./pages/people-page/people-page').then((m) => m.PeoplePage),
  },
];
