import { computed, effect, inject, Service, signal } from '@angular/core';
import { IdentityService } from '@core/auth/identity.service';
import type { RoomListChange } from '../models/room-feed.model';
import type { Room } from '../models/room.model';

@Service()
export class RoomListStore {
  private readonly identity = inject(IdentityService);

  private readonly list = signal<readonly Room[] | undefined>(undefined);
  readonly rooms = this.list.asReadonly();
  /** The connection to the server is down and there is nothing to show yet. */
  readonly failed = signal(false);
  readonly filter = signal('');

  // The hosts and speakers on the cards: names and pictures come from the user service, in one call for the whole hallway.
  private readonly lookup = effect(() => {
    this.identity.resolve((this.rooms() ?? []).flatMap((room) => [room.hostId, ...room.speakers]));
  });

  readonly members = this.identity.directory;
  readonly meId = this.identity.userId;

  readonly languages = computed(() => [
    ...new Set(this.rooms()?.map((room) => room.targetLanguage)),
  ]);
  readonly shown = computed(() =>
    (this.rooms() ?? []).filter((room) => !this.filter() || room.targetLanguage === this.filter()),
  );

  /** Applies one change. Before the list is loaded there is nothing to change: the list, when it arrives, already has it. */
  apply(change: RoomListChange): void {
    if (change.type === 'LISTED') {
      this.list.set(change.rooms);
      this.failed.set(false);
      return;
    }
    this.list.update((rooms) => (rooms === undefined ? undefined : changed(rooms, change)));
  }
}

function changed(rooms: readonly Room[], change: Exclude<RoomListChange, { type: 'LISTED' }>) {
  switch (change.type) {
    case 'ROOM_OPENED':
    case 'ROOM_UPDATED':
      // Newest first, like the server's list; one already there (the list was loaded after it opened) is replaced.
      return rooms.some((room) => room.id === change.room.id)
        ? rooms.map((room) => (room.id === change.room.id ? change.room : room))
        : [change.room, ...rooms];
    case 'ROOM_CLOSED':
      return rooms.filter((room) => room.id !== change.roomId);
    case 'ROOM_STATS':
      return rooms.map((room) =>
        room.id === change.roomId
          ? {
              ...room,
              speakers: change.speakers,
              participantCount: change.participantCount,
              handRaiseCount: change.handRaiseCount,
            }
          : room,
      );
  }
}
