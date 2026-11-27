import { httpErrorInterceptor } from './http/http-error.interceptor';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MatIconRegistry } from '@angular/material/icon';
import { MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';
import { provideClientHydration, withEventReplay, withNoIncrementalHydration } from '@angular/platform-browser';
import {
  provideRouter,
  Routes,
  TitleStrategy,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { roomFeedTransport } from './http/room-feed-transport';
import { authBearerInterceptor } from './auth/auth-bearer.interceptor';
import { AppTitleStrategy } from './routing/app-title-strategy';

export function provideCore(routes: Routes): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([httpErrorInterceptor, authBearerInterceptor, roomFeedTransport])),
    provideClientHydration(withEventReplay(), withNoIncrementalHydration()),
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-icons-round');
    }),
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: {
        appearance: 'outline',
        subscriptSizing: 'dynamic',
      },
    },
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: 'calc(100dvh - 24px)',
        panelClass: ['jtalk-dialog'],
        autoFocus: 'first-tabbable',
      },
    },
    {
      provide: MAT_SNACK_BAR_DEFAULT_OPTIONS,
      useValue: {
        duration: 2800,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['jtalk-snackbar'],
      },
    },
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled',
      }),
    ),
    {
      provide: TitleStrategy,
      useExisting: AppTitleStrategy,
    },
  ]);
}
