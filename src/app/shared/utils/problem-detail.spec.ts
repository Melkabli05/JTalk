import { HttpErrorResponse } from '@angular/common/http';
import { problemDetail } from './problem-detail';

const failure = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

describe('problemDetail', () => {
  it('says what the server said for a conflict or a refusal', () => {
    expect(problemDetail(failure(409, { detail: "The username 'sara' is taken" }), 'Oops')).toBe(
      "The username 'sara' is taken",
    );
    expect(
      problemDetail(failure(422, { detail: 'You can change it again on 2026-12-19' }), 'Oops'),
    ).toBe('You can change it again on 2026-12-19');
  });

  it.each([
    failure(500, { detail: 'boom' }),
    failure(404, { detail: 'nope' }),
    failure(409, 'text'),
    failure(409, { detail: '' }),
    failure(409, null),
    new Error('x'),
    undefined,
  ])('has only the fallback for %j', (error) => {
    expect(problemDetail(error, 'Oops')).toBe('Oops');
  });
});
