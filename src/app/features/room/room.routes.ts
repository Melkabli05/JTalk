import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { AppState } from '../../core/state/app-state';

export const ROOM_ROUTES: Routes = [
  {
    path: ':id',
    title: 'Live room',
    loadComponent: () => import('./pages/room-page/room-page').then((m) => m.RoomPage),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => {
      const roomId = inject(AppState).resumeRoomId();
      const router = inject(Router);
      return router.createUrlTree(roomId ? ['/room', roomId] : ['/rooms']);
    },
  },
];
