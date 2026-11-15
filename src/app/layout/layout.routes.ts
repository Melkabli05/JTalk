import { Routes } from '@angular/router';
import { AppShellComponent } from './shell/app-shell.component';

/**
 * Wraps the given routes in the application shell. It takes the routes as an argument so that
 * layout/ never imports features/: `app.routes.ts` decides what goes inside.
 */
export function layoutRoutes(children: Routes): Routes {
  return [{ path: '', component: AppShellComponent, children }];
}
