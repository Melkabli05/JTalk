import { Service, signal } from '@angular/core';

/** The room the person is in right now, as far as the rest of the app needs to know. */
export interface ActiveRoom {
  readonly id: string;
  readonly title: string;
}

/**
 * Which room the person is in, kept above any one page so the header can show it, and say how to leave it, wherever they are. The rooms
 * feature fills it in and clears it; the shell and sign-out read it. The room itself lives in the rooms feature.
 */
@Service()
export class ActiveRoomService {
  private readonly current = signal<ActiveRoom | null>(null);
  private leaver: (() => void) | undefined;

  readonly room = this.current.asReadonly();

  set(room: ActiveRoom | null): void {
    this.current.set(room);
  }

  /** What leaving means is the rooms feature's business: it says how once, and anyone can then ask for it. */
  onLeave(handler: () => void): void {
    this.leaver = handler;
  }

  leave(): void {
    this.leaver?.();
  }
}
