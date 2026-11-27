import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from '../http/http-error.interceptor';
import { isTransientProfileError, sanitizeReturnUrl } from './auth.utils';

describe('auth.utils', () => {
  describe('sanitizeReturnUrl', () => {
    it('keeps safe internal app routes and query strings', () => {
      expect(sanitizeReturnUrl('/rooms')).toBe('/rooms');
      expect(sanitizeReturnUrl('/room/abc-123')).toBe('/room/abc-123');
      expect(sanitizeReturnUrl('/profile?tab=edit')).toBe('/profile?tab=edit');
      expect(sanitizeReturnUrl('/rooms?action=start')).toBe('/rooms?action=start');
    });

    it('rejects external URLs, protocol-relative URLs, backslashes, and root loops', () => {
      expect(sanitizeReturnUrl(null)).toBe('/rooms');
      expect(sanitizeReturnUrl('')).toBe('/rooms');
      expect(sanitizeReturnUrl('/')).toBe('/rooms');
      expect(sanitizeReturnUrl('/?next=/rooms')).toBe('/rooms');
      expect(sanitizeReturnUrl('//evil.example/rooms')).toBe('/rooms');
      expect(sanitizeReturnUrl('https://evil.example/rooms')).toBe('/rooms');
      expect(sanitizeReturnUrl('/\\evil.example')).toBe('/rooms');
      expect(sanitizeReturnUrl('/rooms\nSet-Cookie: a=1')).toBe('/rooms');
    });
  });

  describe('isTransientProfileError', () => {
    it('flags cold-start proxy/network errors as transient', () => {
      for (const status of [0, 408, 502, 503, 504]) {
        const err = new ApiError(new HttpErrorResponse({ status, url: '/api/v1/users/me' }));
        expect(isTransientProfileError(err)).toBe(true);
      }
      const proxyErr = new ApiError(
        new HttpErrorResponse({
          status: 500,
          error: { type: 'urn:jtalk:proxy:problem:upstream-unavailable' },
        }),
      );
      expect(isTransientProfileError(proxyErr)).toBe(true);
    });

    it('never flags 4xx client errors or non-ApiError exceptions as transient', () => {
      for (const status of [400, 401, 403, 404, 409, 422, 500]) {
        const err = new ApiError(new HttpErrorResponse({ status, url: '/api/v1/users/me' }));
        expect(isTransientProfileError(err)).toBe(false);
      }
      expect(isTransientProfileError(new Error('network'))).toBe(false);
    });
  });
});
