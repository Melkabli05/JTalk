import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadChildren: () => import('./features/home/home.routes').then((m) => m.HOME_ROUTES),
  },
  {
    path: '',
    loadComponent: () => import('./layout/main-layout/main-layout').then((m) => m.MainLayout),
    canActivate: [authGuard],
    children: [
      {
        path: 'rooms',
        loadChildren: () => import('./features/rooms/rooms.routes').then((m) => m.ROOMS_ROUTES),
      },
      {
        path: 'room',
        loadChildren: () => import('./features/room/room.routes').then((m) => m.ROOM_ROUTES),
      },
      {
        path: 'people',
        loadChildren: () => import('./features/people/people.routes').then((m) => m.PEOPLE_ROUTES),
      },
      {
        path: 'profile',
        loadChildren: () =>
          import('./features/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
