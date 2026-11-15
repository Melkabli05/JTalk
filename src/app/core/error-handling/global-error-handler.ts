import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable } from '@angular/core';

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
