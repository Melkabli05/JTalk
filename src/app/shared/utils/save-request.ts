import { signal } from '@angular/core';
import { finalize, type Observable } from 'rxjs';

/**
 * The state of one write (save, sign in, delete) in a container: `submitting` while it runs, `error` with the
 * message to show when it fails. Writes are plain `HttpClient` Observables, not resources, so they are never
 * cancelled or re-run by a signal change.
 */
export function saveRequest() {
  const submitting = signal(false);
  const error = signal<string | null>(null);

  return {
    submitting: submitting.asReadonly(),
    error: error.asReadonly(),

    /** Starts the request. `failure` is the message to show, or a function that picks one from the error. */
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
