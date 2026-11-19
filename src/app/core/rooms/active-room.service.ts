import { Service, signal } from '@angular/core';
import { readItem, writeItem } from '@shared/utils/safe-storage';

const KEY = 'jtalk:room';

/** The room the person is in right now, as far as the rest of the app needs to know. */
export interface ActiveRoom {
  readonly id: string;
  readonly title: string;
  readonly topic: string;
  readonly targetLanguage: string;
  readonly nativeLanguage: string;
  /** The host's name, once it is known. */
  readonly hostName: string;
  readonly participantCount: number;
  /** How many are on the stage, and how many seats it has. */
  readonly speakers: number;
  readonly seats: number;
}

/**
 * Which room the person is in, kept above any one page so the header can show it, and say how to leave it, wherever they are. The rooms
 * feature fills it in and clears it; the shell and sign-out read it. The room itself lives in the rooms feature.
 *
 * The room is also written to this tab's session storage, which a reload keeps and closing the tab does not: a reload takes the person
 * back to the room they were in ({@link remembered}), closing the tab ends it.
 */
@Service()
export class ActiveRoomService {
  private readonly current = signal<ActiveRoom | null>(null);
  private leaver: (() => void) | undefined;

  readonly room = this.current.asReadonly();
  /** The room this tab was in when it was reloaded, if it was in one: read once, when the app starts. */
  readonly remembered: string | null = readItem('session', KEY);

  set(room: ActiveRoom | null): void {
    this.current.set(room);
    writeItem('session', KEY, room?.id ?? null);
  }

  /** What leaving means is the rooms feature's business: it says how once, and anyone can then ask for it. */
  onLeave(handler: () => void): void {
    this.leaver = handler;
  }

  leave(): void {
    this.leaver?.();
  }
}
