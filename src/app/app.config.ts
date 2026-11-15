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
import { authInterceptor } from '@core/http/auth.interceptor';
import { devIdentityInterceptor } from '@core/http/dev-identity.interceptor';
import { routes } from './app.routes';
import { I18n } from '@shared/utils/i18n/i18n.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    provideHttpClient(
      withInterceptors([devIdentityInterceptor, authInterceptor, httpErrorInterceptor]),
    ),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
    provideOptimus({
      theme: { preset: JtalkPreset, options: { darkModeSelector: `.${DARK_CLASS}` } },
    }),
    MessageService,
    provideAppInitializer(() => {
      inject(ColorSchemeService);
      inject(DirectionService);
      return inject(I18n).init();
    }),
  ],
};
