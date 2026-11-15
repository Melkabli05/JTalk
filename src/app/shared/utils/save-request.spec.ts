import { Subject, throwError } from 'rxjs';
import { saveRequest } from './save-request';

describe('saveRequest', () => {
  it('is idle at first', () => {
    const state = saveRequest();
    expect(state.submitting()).toBe(false);
    expect(state.error()).toBeNull();
  });

  it('is submitting until the request completes, then hands over the result', () => {
    const state = saveRequest();
    const response = new Subject<string>();
    const next = vi.fn();
    state.run(response, { next, failure: 'nope' });
    expect(state.submitting()).toBe(true);

    response.next('ok');
    response.complete();

    expect(next).toHaveBeenCalledExactlyOnceWith('ok');
    expect(state.submitting()).toBe(false);
    expect(state.error()).toBeNull();
  });

  it('shows the failure message and stops submitting', () => {
    const state = saveRequest();
    const next = vi.fn();
    state.run(
      throwError(() => new Error('boom')),
      { next, failure: 'Could not save.' },
    );

    expect(next).not.toHaveBeenCalled();
    expect(state.error()).toBe('Could not save.');
    expect(state.submitting()).toBe(false);
  });

  it('lets the caller pick the message from the error, and clears it on the next run', () => {
    const state = saveRequest();
    state.run(
      throwError(() => new Error('boom')),
      {
        next: vi.fn(),
        failure: (cause) => (cause as Error).message,
      },
    );
    expect(state.error()).toBe('boom');

    state.run(new Subject<void>(), { next: vi.fn(), failure: 'x' });
    expect(state.error()).toBeNull();
  });
});
