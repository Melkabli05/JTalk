import { inject, Service, signal, type Provider } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { msg } from '@shared/utils/i18n/msg';
import { saveRequest } from '@shared/utils/save-request';
import { RoomsApiService } from '../data-access/rooms-api.service';
import type { RoomDraft } from '../models/room.model';
import { RoomsStore } from './rooms.store';

const REFRESH_MS = 5000;

/**
 * What the hallway page needs: the state of the list (`state`), whether a room is being opened (`opening`), and the two
 * things a person does there, narrow the list and start a room. It keeps the list fresh while the page is open.
 */
@Service()
export class RoomsFacade {
  private readonly store = inject(RoomsStore);
  private readonly api = inject(RoomsApiService);

  readonly state = this.store;
  readonly opening = saveRequest();
  private readonly formOpen = signal(false);
  /** The start-a-room form is open. */
  readonly starting = this.formOpen.asReadonly();

  constructor() {
    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.store.reload());
  }

  filterBy(language: string): void {
    this.store.setFilter(language);
  }

  /** Opens or closes the start-a-room form. */
  showStartForm(open: boolean): void {
    this.formOpen.set(open);
  }

  /** Opens a room as its host. `opened` gets the new room's id once it is open. */
  start(draft: RoomDraft, opened: (roomId: string) => void): void {
    this.opening.run(this.api.create(draft), {
      next: (session) => {
        this.formOpen.set(false);
        opened(session.room.id);
      },
      failure: msg('Could not open the room. Please try again.'),
    });
  }
}

/** What the hallway page provides: the state and the facade, living and dying with the page. */
export function provideRooms(): Provider[] {
  return [RoomsStore, RoomsFacade];
}
