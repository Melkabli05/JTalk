import { computed, DestroyRef, inject, Service, signal } from '@angular/core';

const MINUTE = 60_000;

/**
 * The person's own time of day, kept fresh: the hour is read from their clock and read again every minute, so a page that stays open
 * through noon changes its greeting on its own. Whatever shows the time reads {@link hour} and needs no timer of its own.
 */
@Service()
export class ClockService {
  private readonly now = signal(new Date());

  /** The hour on the person's clock, 0 to 23. */
  readonly hour = computed(() => this.now().getHours());

  constructor() {
    const timer = setInterval(() => this.now.set(new Date()), MINUTE);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
