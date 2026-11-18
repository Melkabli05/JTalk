import { authGuardFn } from '@auth0/auth0-angular';
import { Routes } from '@angular/router';
import { AppShellComponent } from './shell/app-shell.component';

export function layoutRoutes(children: Routes): Routes {
  return [{ path: '', component: AppShellComponent, canActivate: [authGuardFn], children }];
}
