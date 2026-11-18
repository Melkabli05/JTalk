import { TestBed } from '@angular/core/testing';
import { visibleInterval } from './visible-interval';

function show(state: 'visible' | 'hidden'): void {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('visibleInterval', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function start() {
    const ticks = vi.fn();
    const subscription = TestBed.runInInjectionContext(() => visibleInterval(1000)).subscribe(
      ticks,
    );
    return { ticks, subscription };
  }

  it('ticks every period while the page is visible', () => {
    show('visible');
    const { ticks, subscription } = start();

    vi.advanceTimersByTime(3000);

    expect(ticks).toHaveBeenCalledTimes(3);
    subscription.unsubscribe();
  });

  it('is silent while the page is hidden', () => {
    show('hidden');
    const { ticks, subscription } = start();

    vi.advanceTimersByTime(10_000);

    expect(ticks).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });

  it('stops when the page is hidden and ticks at once when it is shown again', () => {
    show('visible');
    const { ticks, subscription } = start();
    vi.advanceTimersByTime(1000);
    expect(ticks).toHaveBeenCalledTimes(1);

    show('hidden');
    vi.advanceTimersByTime(60_000);
    expect(ticks).toHaveBeenCalledTimes(1);

    show('visible');
    vi.advanceTimersByTime(0);
    expect(ticks).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1000);
    expect(ticks).toHaveBeenCalledTimes(3);
    subscription.unsubscribe();
  });
});
