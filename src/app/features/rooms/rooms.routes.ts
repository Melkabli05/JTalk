import { Routes } from '@angular/router';

export const ROOMS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Rooms',
    data: { wide: true },
    loadComponent: () => import('./pages/room-list-page/room-list-page.component'),
  },
  {
    path: 'rooms/:id',
    title: 'Room',
    data: { wide: true },
    loadComponent: () => import('./pages/room-page/room-page.component'),
  },
];
