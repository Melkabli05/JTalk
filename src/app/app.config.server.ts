import { ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { routes } from './app.routes';
import { serverRoutes } from './app.routes.server';
import { provideServerAuthStub } from './core/auth/auth.providers';
import { provideCore } from './core/provide-core';

export const config: ApplicationConfig = {
  providers: [
    provideCore(routes),
    provideServerRendering(withRoutes(serverRoutes)),
    provideServerAuthStub(),
  ],
};
