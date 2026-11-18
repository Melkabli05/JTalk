import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { distinctUntilChanged, fromEvent, map, type Observable, startWith } from 'rxjs';

/** Whether the page is on screen now, and each time that changes. Call it in an injection context. */
export function pageVisible(): Observable<boolean> {
  const document = inject(DOCUMENT);
  return fromEvent(document, 'visibilitychange').pipe(
    startWith(null),
    map(() => document.visibilityState === 'visible'),
    distinctUntilChanged(),
  );
}
