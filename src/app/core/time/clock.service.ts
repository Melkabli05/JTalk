import { computed, DestroyRef, inject, Service, signal } from '@angular/core';

/** The hour on the person's clock, refreshed every minute. */
@Service()
export class ClockService {
  private readonly now = signal(new Date());

  readonly hour = computed(() => this.now().getHours());

  constructor() {
    const timer = setInterval(() => this.now.set(new Date()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
