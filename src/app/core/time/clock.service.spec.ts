import { TestBed } from '@angular/core/testing';
import { ClockService } from './clock.service';

describe('ClockService', () => {
  afterEach(() => vi.useRealTimers());

  it('is the hour on the clock now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 19, 9, 30));

    expect(TestBed.inject(ClockService).hour()).toBe(9);
  });

  it('moves on by itself as the day goes by, so a page left open changes its greeting', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 19, 11, 59, 30));
    const clock = TestBed.inject(ClockService);
    expect(clock.hour()).toBe(11);

    vi.advanceTimersByTime(60_000);

    expect(clock.hour()).toBe(12);
  });

  it('stops its timer when it is destroyed', () => {
    vi.useFakeTimers();
    TestBed.inject(ClockService);
    expect(vi.getTimerCount()).toBe(1);

    TestBed.resetTestingModule();

    expect(vi.getTimerCount()).toBe(0);
  });
});
