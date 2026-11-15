import { inject, Service, type Provider } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { msg } from '@shared/utils/i18n/msg';
import { saveRequest } from '@shared/utils/save-request';
import { RoomsApiService } from '../data-access/rooms-api.service';
import type { RoomDraft } from '../models/room.model';
import { RoomListStore } from './room-list.store';

const REFRESH_MS = 5000;

@Service()
export class RoomListFacade {
  private readonly api = inject(RoomsApiService);

  readonly state = inject(RoomListStore);
  readonly opening = saveRequest();

  constructor() {
    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.state.reload());
  }

  start(draft: RoomDraft, opened: (roomId: string) => void): void {
    this.opening.run(this.api.create(draft), {
      next: (session) => opened(session.room.id),
      failure: msg('Could not open the room. Please try again.'),
    });
  }
}

export function provideRoomList(): Provider[] {
  return [RoomListStore, RoomListFacade];
}
