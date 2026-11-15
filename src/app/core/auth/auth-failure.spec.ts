import { HttpErrorResponse } from '@angular/common/http';
import { authFailure } from './auth-failure';

describe('authFailure', () => {
  const failure = authFailure('Fallback.');

  it('asks to slow down on 429', () => {
    expect(failure(new HttpErrorResponse({ status: 429 }))).toContain('Too many attempts');
  });

  it('uses the message registered for the status', () => {
    const byStatus = authFailure('Fallback.', { 401: 'Wrong.', 429: 'ignored' });
    expect(byStatus(new HttpErrorResponse({ status: 401 }))).toBe('Wrong.');
    expect(byStatus(new HttpErrorResponse({ status: 429 }))).toContain('Too many attempts');
  });

  it.each([new HttpErrorResponse({ status: 500 }), new Error('offline'), 'weird'])(
    'uses the fallback for %j',
    (error) => {
      expect(failure(error)).toBe('Fallback.');
    },
  );
});
