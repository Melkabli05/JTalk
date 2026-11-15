import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

export const DEV_IDENTITY = new InjectionToken<boolean>('DEV_IDENTITY', {
  providedIn: 'root',
  factory: () => environment.devIdentity,
});
