import { HttpErrorResponse } from '@angular/common/http';

export function httpStatus(error: unknown): number | undefined {
  return error instanceof HttpErrorResponse ? error.status : undefined;
}
