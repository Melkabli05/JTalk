import { inject, Service, type Provider } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { msg } from '@shared/utils/i18n/msg';
import { saveRequest } from '@shared/utils/save-request';
import { RoomsApiService } from '../data-access/rooms-api.service';
import type { RoomDraft } from '../models/room.model';
import { RoomsStore } from './rooms.store';

const REFRESH_MS = 5000;

/**
 * What the hallway page needs: the state of the list (`state`), and starting a room (`opening` is the state of that
 * request). It keeps the list fresh while the page is open.
 */
@Service()
export class RoomsFacade {
  private readonly api = inject(RoomsApiService);

  readonly state = inject(RoomsStore);
  readonly opening = saveRequest();

  constructor() {
    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.state.reload());
  }

  /** Opens a room as its host. `opened` gets the new room's id once it is open. */
  start(draft: RoomDraft, opened: (roomId: string) => void): void {
    this.opening.run(this.api.create(draft), {
      next: (session) => opened(session.room.id),
      failure: msg('Could not open the room. Please try again.'),
    });
  }
}

/** What the hallway page provides: the state and the facade, living and dying with the page. */
export function provideRooms(): Provider[] {
  return [RoomsStore, RoomsFacade];
}
