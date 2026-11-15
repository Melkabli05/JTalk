import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Base URL of the backend API. Override in a test with `{ provide: API_BASE_URL, useValue: '…' }`. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiUrl,
});
