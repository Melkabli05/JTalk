import type { Routes } from '@angular/router';
import { unsavedProfileGuard } from './guards/unsaved-profile.guard';
import { ProfileFacade } from './store/profile.facade';
import { ProfileStore } from './store/profile.store';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    providers: [ProfileStore, ProfileFacade],
    loadComponent: () => import('./pages/profile-page/profile-page').then((m) => m.ProfilePage),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Profile',
        loadComponent: () =>
          import('./pages/profile-overview-page/profile-overview-page').then(
            (m) => m.ProfileOverviewPage,
          ),
      },
      {
        path: 'edit',
        title: 'Edit profile',
        canDeactivate: [unsavedProfileGuard],
        loadComponent: () =>
          import('./pages/profile-edit-page/profile-edit-page').then((m) => m.ProfileEditPage),
      },
      {
        path: 'account',
        title: 'Account',
        loadComponent: () =>
          import('./pages/profile-account-page/profile-account-page').then(
            (m) => m.ProfileAccountPage,
          ),
      },
    ],
  },
];
