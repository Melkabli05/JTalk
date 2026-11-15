import { signal } from '@angular/core';
import { finalize, type Observable } from 'rxjs';

export function saveRequest() {
  const submitting = signal(false);
  const error = signal<string | null>(null);

  return {
    submitting: submitting.asReadonly(),
    error: error.asReadonly(),

    run<T>(
      request: Observable<T>,
      options: { next: (value: T) => void; failure: string | ((error: unknown) => string) },
    ): void {
      submitting.set(true);
      error.set(null);
      request.pipe(finalize(() => submitting.set(false))).subscribe({
        next: options.next,
        error: (cause: unknown) =>
          error.set(
            typeof options.failure === 'function' ? options.failure(cause) : options.failure,
          ),
      });
    },
  };
}
