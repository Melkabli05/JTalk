import { HttpErrorResponse } from '@angular/common/http';

/**
 * What the server says went wrong, in its own words, for the refusals it means a person to read (a username that is taken, one changed
 * too recently, a picture it will not take): a 409 or a 422 with a problem body. Anything else is `fallback`.
 */
export function problemDetail(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && (error.status === 409 || error.status === 422)) {
    const body: unknown = error.error;
    const detail =
      typeof body === 'object' && body !== null && 'detail' in body ? body.detail : undefined;
    if (typeof detail === 'string' && detail !== '') {
      return detail;
    }
  }
  return fallback;
}
