import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { routes } from './app.routes';
import { provideBrowserAuth0 } from './core/auth/auth.providers';
import { provideCore } from './core/provide-core';
import { PwaService } from './core/services/pwa';

export const appConfig: ApplicationConfig = {
  providers: [
    provideCore(routes),
    provideBrowserAuth0(),
    provideAppInitializer(() => {
      inject(PwaService).init();
    }),
  ],
};
