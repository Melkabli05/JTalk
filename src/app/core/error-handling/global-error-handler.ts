import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable } from '@angular/core';

/**
 * Last stop for errors nobody caught. Keeps one consistent log format; send errors to a reporting
 * service from here if you add one.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      console.error(`[http] ${error.status} ${error.url ?? ''}`.trim(), error.message);
      return;
    }
    console.error('[app]', error);
  }
}
