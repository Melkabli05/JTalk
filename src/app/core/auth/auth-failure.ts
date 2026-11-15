import { HttpErrorResponse } from '@angular/common/http';
import { msg } from '@shared/utils/i18n/msg';

const RATE_LIMITED = msg('Too many attempts. Wait a few minutes and try again.');

/**
 * Builds the `failure` message function for a failed account request: "slow down" for 429, the message
 * registered for the HTTP status in `byStatus`, otherwise `fallback`. Messages never say whether an
 * address or account exists.
 */
export function authFailure(
  fallback: string,
  byStatus: Readonly<Record<number, string>> = {},
): (error: unknown) => string {
  return (error) => {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }
    return error.status === 429 ? RATE_LIMITED : (byStatus[error.status] ?? fallback);
  };
}
