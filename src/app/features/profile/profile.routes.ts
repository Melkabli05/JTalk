import { Routes } from '@angular/router';
import { ProfileFacade } from './store/profile.facade';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    title: 'Profile',
    providers: [ProfileFacade],
    loadComponent: () => import('./pages/profile-page/profile-page').then((m) => m.ProfilePage),
  },
];
