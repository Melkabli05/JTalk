import { computed, DestroyRef, inject, signal } from '@angular/core';
import type { Observable, Subscription } from 'rxjs';

/** One page of a list, and where the next one starts (`null` when this was the last). The cursor is whatever the server asks for. */
export interface Page<T, Cursor> {
  readonly items: readonly T[];
  readonly next: Cursor | null;
}

/**
 * A list that is read a page at a time and grows as more is asked for, with the state a screen needs around it: loading, failed,
 * and whether there is more. Call it where the list is owned (a field of a service or a page): it ends its request with its owner.
 */
export function pagedList<T extends { readonly id: string }, Cursor>(
  fetch: (cursor: Cursor | null) => Observable<Page<T, Cursor>>,
) {
  const items = signal<readonly T[]>([]);
  const loading = signal(false);
  const failed = signal(false);
  const loaded = signal(false);
  const next = signal<Cursor | null>(null);
  let request: Subscription | undefined;

  inject(DestroyRef).onDestroy(() => request?.unsubscribe());

  function read(cursor: Cursor | null): void {
    request?.unsubscribe();
    loading.set(true);
    failed.set(false);
    request = fetch(cursor).subscribe({
      next: (page) => {
        items.update((now) => {
          const kept = cursor === null ? [] : now;
          const known = new Set(kept.map((item) => item.id));
          return [...kept, ...page.items.filter((item) => !known.has(item.id))];
        });
        next.set(page.next);
        loaded.set(true);
        loading.set(false);
      },
      error: () => {
        failed.set(true);
        loading.set(false);
      },
    });
  }

  return {
    items: items.asReadonly(),
    loading: loading.asReadonly(),
    failed: failed.asReadonly(),
    loaded: loaded.asReadonly(),
    hasMore: computed(() => next() !== null),
    /** Reads the first page, once: a second call while it is loading or already read does nothing. */
    load(): void {
      if (!loaded() && !loading()) {
        read(null);
      }
    },
    /** Reads the page after the last one, if there is one. */
    more(): void {
      const cursor = next();
      if (cursor !== null && !loading()) {
        read(cursor);
      }
    },
    /** Starts again from the first page, or tries again after a failure. */
    reload(): void {
      read(null);
    },
    /** Takes someone out of what is shown, without asking the server again. */
    remove(id: string): void {
      items.update((now) => now.filter((item) => item.id !== id));
    },
  };
}
