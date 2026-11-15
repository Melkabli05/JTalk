import { HttpErrorResponse } from '@angular/common/http';

/** The status code of a failed request, or `undefined` when the error is not an HTTP one. */
export function httpStatus(error: unknown): number | undefined {
  return error instanceof HttpErrorResponse ? error.status : undefined;
}
