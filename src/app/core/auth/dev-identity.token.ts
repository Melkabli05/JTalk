import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/** True only in a development build, where the caller is named by `X-User-Id`. Override in a test with `{ provide: DEV_IDENTITY, useValue: true }`. */
export const DEV_IDENTITY = new InjectionToken<boolean>('DEV_IDENTITY', {
  providedIn: 'root',
  factory: () => environment.devIdentity,
});
