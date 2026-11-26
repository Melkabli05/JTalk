import { isPlatformBrowser } from '@angular/common';
import { ApplicationConfig, inject, PLATFORM_ID, provideAppInitializer } from '@angular/core';
import { routes } from './app.routes';
import { provideBrowserAuth0 } from './core/auth/auth.providers';
import { provideCore } from './core/provide-core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideCore(routes),
    provideBrowserAuth0(),
    provideAppInitializer(() => {
      if (isPlatformBrowser(inject(PLATFORM_ID)) && 'serviceWorker' in navigator) {
        void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
      }
    }),
  ],
};
