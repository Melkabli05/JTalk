import { timeAgo } from './time-ago';

describe('timeAgo', () => {
  const now = Date.parse('2026-11-19T12:00:00Z');
  const before = (ms: number) => new Date(now - ms).toISOString();

  it('says just now for the first minute, and for a clock that is a little behind', () => {
    expect(timeAgo(before(5_000), now)).toBe('Just now');
    expect(timeAgo(before(-5_000), now)).toBe('Just now');
  });

  it('counts minutes, hours and days, rounding down', () => {
    expect(timeAgo(before(60_000), now)).toBe('1m ago');
    expect(timeAgo(before(59 * 60_000), now)).toBe('59m ago');
    expect(timeAgo(before(3_600_000), now)).toBe('1h ago');
    expect(timeAgo(before(25 * 3_600_000), now)).toBe('1d ago');
  });

  it('says nothing for what is not a date', () => {
    expect(timeAgo('soon', now)).toBe('');
  });
});
