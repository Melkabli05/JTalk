import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import {
  defer,
  distinctUntilChanged,
  EMPTY,
  fromEvent,
  map,
  type Observable,
  startWith,
  switchMap,
  timer,
} from 'rxjs';

/**
 * A timer for background refreshing: ticks every {@code period} ms while the page is visible and stops while it is hidden, so a tab
 * nobody is looking at costs the servers nothing. When the page comes back it ticks at once (the data may be old by now), then
 * carries on every period. Call it in an injection context.
 */
export function visibleInterval(period: number): Observable<void> {
  const document = inject(DOCUMENT);
  return defer(() => {
    let wasHidden = false;
    return fromEvent(document, 'visibilitychange').pipe(
      startWith(null),
      map(() => document.visibilityState === 'visible'),
      distinctUntilChanged(),
      switchMap((visible) => {
        if (!visible) {
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
