import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { IdentityService } from '../auth/identity.service';
import { API_BASE_URL } from './api-base-url.token';

export const devIdentityInterceptor: HttpInterceptorFn = (req, next) => {
  const userId = inject(IdentityService).devUserId();
  if (!userId || !req.url.startsWith(`${inject(API_BASE_URL)}/`)) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { 'X-User-Id': userId } }));
};
