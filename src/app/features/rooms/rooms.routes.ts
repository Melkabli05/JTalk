import { Routes } from '@angular/router';
import { msg } from '@shared/utils/i18n/msg';

export const ROOMS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: msg('Rooms'),
    data: { wide: true },
    loadComponent: () => import('./pages/room-list-page/room-list-page.component'),
  },
  {
    path: 'rooms/:id',
    title: msg('Room'),
    data: { breadcrumb: msg('Room'), wide: true },
    loadComponent: () => import('./pages/room-page/room-page.component'),
  },
];
