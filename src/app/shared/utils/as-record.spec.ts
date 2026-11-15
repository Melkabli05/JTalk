import { asRecord } from './as-record';

describe('asRecord', () => {
  it('returns plain objects as they are', () => {
    const value = { id: 1 };
    expect(asRecord(value)).toBe(value);
  });

  it.each([null, undefined, 'text', 5, true, [], [{ id: 1 }]])('rejects %j', (value) => {
    expect(asRecord(value)).toBeUndefined();
  });
});
