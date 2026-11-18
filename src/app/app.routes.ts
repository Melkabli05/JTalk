import { Routes } from '@angular/router';
import { msg } from '@shared/utils/i18n/msg';
import { layoutRoutes } from './layout/layout.routes';

export const routes: Routes = [
  ...layoutRoutes([
    {
      path: '',
      loadChildren: () => import('./features/rooms/rooms').then((m) => m.ROOMS_ROUTES),
    },
    {
      path: 'profile',
      loadChildren: () => import('./features/profile/profile').then((m) => m.PROFILE_ROUTES),
    },
    {
      path: 'people',
      loadChildren: () => import('./features/profile/profile').then((m) => m.PEOPLE_ROUTES),
    },
    {
      path: '**',
      title: msg('Page not found'),
      loadComponent: () =>
        import('@core/error-handling/pages/not-found-page/not-found-page.component'),
    },
  ]),
];
