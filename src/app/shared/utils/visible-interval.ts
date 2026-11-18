import { defer, EMPTY, map, type Observable, switchMap, timer } from 'rxjs';
import { pageVisible } from './page-visible';

/**
 * A timer for background refreshing: ticks every {@code period} ms while the page is visible and stops while it is hidden, so a tab
 * nobody is looking at costs the servers nothing. When the page comes back it ticks at once (the data may be old by now), then
 * carries on every period. Call it in an injection context.
 */
export function visibleInterval(period: number): Observable<void> {
  const visible = pageVisible();
  return defer(() => {
    let wasHidden = false;
    return visible.pipe(
      switchMap((isVisible) => {
        if (!isVisible) {
          wasHidden = true;
          return EMPTY;
        }
        const first = wasHidden ? 0 : period;
        wasHidden = false;
        return timer(first, period);
      }),
      map(() => undefined),
    );
  });
}
