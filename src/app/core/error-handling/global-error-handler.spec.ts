import { HttpErrorResponse } from '@angular/common/http';
import type { MockInstance } from 'vitest';
import { GlobalErrorHandler } from './global-error-handler';

describe('GlobalErrorHandler', () => {
  let log: MockInstance<typeof console.error>;

  beforeEach(() => {
    log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => log.mockRestore());

  it('logs HTTP failures with status and URL', () => {
    new GlobalErrorHandler().handleError(
      new HttpErrorResponse({ status: 500, url: '/api/users', statusText: 'Server Error' }),
    );

    expect(log).toHaveBeenCalledWith('[http] 500 /api/users', expect.any(String));
  });

  it('logs anything else as an application error', () => {
    const error = new Error('boom');
    new GlobalErrorHandler().handleError(error);

    expect(log).toHaveBeenCalledWith('[app]', error);
  });
});
