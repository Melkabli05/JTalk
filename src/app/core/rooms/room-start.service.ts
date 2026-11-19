import { Service, signal } from '@angular/core';

/**
 * A request to start a room, made from anywhere (the sidebar's Go live card) and answered by the rooms hallway, which owns the form. The
 * request waits until the hallway is there to take it, so it works from a page that is not the hallway too.
 */
@Service()
export class RoomStartService {
  private readonly asked = signal(false);

  readonly requested = this.asked.asReadonly();

  request(): void {
    this.asked.set(true);
  }

  /** The hallway took the request. */
  taken(): void {
    this.asked.set(false);
  }
}
