import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { API_BASE_URL } from './api-base-url.token';

/** Attaches the bearer token to requests aimed at our own API, and only those. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();
  const baseUrl = inject(API_BASE_URL);
  if (!token || !req.url.startsWith(`${baseUrl}/`)) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
