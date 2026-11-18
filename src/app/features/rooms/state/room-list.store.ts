import { computed, effect, inject, Service, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { IdentityService } from '@core/auth/identity.service';
import { loadedValue } from '@shared/utils/resource-value';
import { scan } from 'rxjs';
import { RoomsApiService } from '../data-access/rooms-api.service';
import type { RoomFeedEvent } from '../models/room-feed.model';
import type { Room } from '../models/room.model';

/** The list after one more thing happened. Before the list has arrived there is nothing to change. */
export function changed(
  rooms: readonly Room[] | undefined,
  event: RoomFeedEvent,
): readonly Room[] | undefined {
  if (event.type === 'SNAPSHOT') {
    return event.rooms;
  }
  if (rooms === undefined) {
    return undefined;
  }
  switch (event.type) {
    case 'ROOM_OPENED':
    case 'ROOM_UPDATED':
      // Newest first, like the server's list; a room already there (the list was read after it opened) is replaced.
      return rooms.some((room) => room.id === event.room.id)
        ? rooms.map((room) => (room.id === event.room.id ? event.room : room))
        : [event.room, ...rooms];
    case 'ROOM_CLOSED':
      return rooms.filter((room) => room.id !== event.roomId);
    case 'ROOM_STATS':
      return rooms.map((room) =>
        room.id === event.roomId
          ? {
              ...room,
              speakers: event.speakers,
              participantCount: event.participantCount,
              handRaiseCount: event.handRaiseCount,
            }
          : room,
      );
  }
}

@Service()
export class RoomListStore {
  private readonly api = inject(RoomsApiService);
  private readonly identity = inject(IdentityService);

  // One request for as long as the hallway is open: the list arrives first, and every change after it is applied to it.
  private readonly resource = rxResource<readonly Room[] | undefined, void>({
    stream: () => this.api.feed().pipe(scan(changed, undefined)),
  });

  readonly rooms = loadedValue(this.resource);
  readonly failed = computed(() => this.resource.error() !== undefined);
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

  /** Opens the connection again, after it gave up. */
  reload(): void {
    this.resource.reload();
  }
}
