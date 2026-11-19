import { inject, Service, type Provider } from '@angular/core';
import { saveRequest } from '@shared/utils/save-request';
import { RoomsApiService } from '../data-access/rooms-api.service';
import type { RoomDraft } from '../models/room.model';
import { RoomListStore } from './room-list.store';

@Service()
export class RoomListFacade {
  private readonly api = inject(RoomsApiService);

  readonly state = inject(RoomListStore);
  readonly opening = saveRequest();

  start(draft: RoomDraft, opened: (roomId: string) => void): void {
    this.opening.run(this.api.create(draft), {
      next: (session) => opened(session.room.id),
      failure: 'Could not open the room. Please try again.',
    });
  }
}

export function provideRoomList(): Provider[] {
  return [RoomListStore, RoomListFacade];
}
