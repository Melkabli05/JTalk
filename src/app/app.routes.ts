import { Routes } from '@angular/router';
import { signedOutGuard } from '@core/auth/signed-out.guard';
import { layoutRoutes } from './layout/layout.routes';

export const routes: Routes = [
  // The front address is the home page for someone who is not signed in, and the rooms hallway (below) for someone who is.
  {
    path: '',
    pathMatch: 'full',
    canMatch: [signedOutGuard],
    loadChildren: () => import('./features/home/home').then((m) => m.HOME_ROUTES),
  },
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
      title: 'Page not found',
      loadComponent: () =>
        import('@core/error-handling/pages/not-found-page/not-found-page.component'),
    },
  ]),
];
