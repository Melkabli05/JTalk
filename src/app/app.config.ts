import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  ErrorHandler,
  inject,
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
import { MessageService } from '@openng/optimus-ui/api';
import { provideOptimus } from '@openng/optimus-ui/config';
import { ColorSchemeService, DARK_CLASS } from '@core/config/color-scheme.service';
import { DirectionService } from '@core/config/direction.service';
import { JtalkPreset } from '@core/config/jtalk-preset';
import { PageTitleStrategy } from '@core/config/page-title.strategy';
import { GlobalErrorHandler } from '@core/error-handling/global-error-handler';
import { httpErrorInterceptor } from '@core/error-handling/http-error.interceptor';
import { IdentityService } from '@core/auth/identity.service';
import { authInterceptor } from '@core/http/auth.interceptor';
import { devIdentityInterceptor } from '@core/http/dev-identity.interceptor';
import { routes } from './app.routes';
import { I18n } from '@shared/utils/i18n/i18n.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    // Preload every lazy feature after the first navigation: two small features, so no blank wait later.
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    // Order matters: attach credentials first, then handle failures on the way back.
    provideHttpClient(
      withInterceptors([devIdentityInterceptor, authInterceptor, httpErrorInterceptor]),
    ),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
    provideOptimus({
      theme: { preset: JtalkPreset, options: { darkModeSelector: `.${DARK_CLASS}` } },
    }),
    // The app-wide <p-toast /> (app.html) shows what pages add through this service.
    MessageService,
    // Instantiate eagerly so the saved color scheme, direction and language are applied at startup.
    provideAppInitializer(() => {
      inject(ColorSchemeService);
      inject(DirectionService);
      return inject(I18n).init();
    }),
    // Development builds only: learn the backend's named test users before the first request needs one.
    provideAppInitializer(() => inject(IdentityService).load()),
  ],
};
