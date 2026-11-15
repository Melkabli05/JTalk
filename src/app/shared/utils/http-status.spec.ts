import { HttpErrorResponse } from '@angular/common/http';
import { httpStatus } from './http-status';

describe('httpStatus', () => {
  it('reads the status of an HTTP error, and nothing else', () => {
    expect(httpStatus(new HttpErrorResponse({ status: 403 }))).toBe(403);
    expect(httpStatus(new Error('403'))).toBeUndefined();
    expect(httpStatus(undefined)).toBeUndefined();
  });
});
