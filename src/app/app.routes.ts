import { Routes } from '@angular/router';
import { AUTH_ROUTES } from '@core/auth/auth.routes';
import { msg } from '@shared/utils/i18n/msg';
import { layoutRoutes } from './layout/layout.routes';

// Every feature is lazy-loaded at its boundary through its public API file. `data.breadcrumb`
// feeds the breadcrumbs in the shell, `data.wide` lets a page use the whole content width;
// protect a route with `canActivate: [authGuard]`.
export const routes: Routes = [
  // Sign in, register and password reset live outside the shell (see core/auth/auth.routes.ts).
  ...AUTH_ROUTES,
  ...layoutRoutes([
    {
      path: '',
      pathMatch: 'full',
      loadChildren: () => import('./features/home/home').then((m) => m.HOME_ROUTES),
    },
    {
      path: '**',
      title: msg('Page not found'),
      loadComponent: () =>
        import('@core/error-handling/pages/not-found-page/not-found-page.component'),
    },
  ]),
];
