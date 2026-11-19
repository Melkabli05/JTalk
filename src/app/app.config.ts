import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  Injector,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  PreloadAllModules,
  provideRouter,
  TitleStrategy,
  withComponentInputBinding,
  withPreloading,
} from '@angular/router';
import { authHttpInterceptorFn, provideAuth0 } from '@auth0/auth0-angular';
import { MessageService } from '@openng/optimus-ui/api';
import { provideOptimus } from '@openng/optimus-ui/config';
import { ColorSchemeService, DARK_CLASS } from '@core/config/color-scheme.service';
import { JtalkPreset } from '@core/config/jtalk-preset';
import { PageTitleStrategy } from '@core/config/page-title.strategy';
import { GlobalErrorHandler } from '@core/error-handling/global-error-handler';
import { ActiveRoomService } from '@core/rooms/active-room.service';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    provideAuth0({
      domain: environment.auth0.domain,
      clientId: environment.auth0.clientId,
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: environment.auth0.audience,
      },
      // Refresh tokens kept in this browser keep a person signed in across reloads; where the tenant does not hand them out, the SDK
      // falls back to a silent sign-in.
      cacheLocation: 'localstorage',
      useRefreshTokens: true,
      useRefreshTokensFallback: true,
      // The access token goes to our own API and nowhere else.
      httpInterceptor: { allowedList: [`${environment.apiUrl}/*`] },
    }),
    provideHttpClient(withInterceptors([authHttpInterceptorFn])),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
    provideOptimus({
      theme: { preset: JtalkPreset, options: { darkModeSelector: `.${DARK_CLASS}` } },
    }),
    MessageService,
    provideAppInitializer(() => {
      inject(ColorSchemeService);
    }),
    // A reload does not leave the room: the one this tab was in is joined again, without holding up the start of the app.
    provideAppInitializer(() => {
      const injector = inject(Injector);
      const id = inject(ActiveRoomService).remembered;
      if (id !== null) {
        void import('./restore-room').then((module) => module.restoreRoom(injector, id));
      }
    }),
  ],
};
