import { computed, inject, Service, signal } from '@angular/core';
import { IdentityService } from '@core/auth/identity.service';
import { loadedValue } from '@shared/utils/resource-value';
import { RoomsApiService } from '../data-access/rooms-api.service';

/**
 * The state of the hallway: the open rooms the server lists, the language the person narrowed them to, and what follows
 * (which languages there are, which rooms to show). Signals and nothing else: `RoomsFacade` keeps it fresh. Provide it,
 * with the facade, per page.
 */
@Service()
export class RoomsStore {
  private readonly api = inject(RoomsApiService);
  private readonly identity = inject(IdentityService);

  private readonly resource = this.api.roomsResource();

  /** The open rooms; `undefined` until the server has answered, and when it could not. */
  readonly rooms = loadedValue(this.resource);
  readonly failed = computed(() => this.resource.error() !== undefined);
  /** The language the list is narrowed to; empty shows every room. */
  readonly filter = signal('');

  /** Everyone the app knows by name, and who this person is. */
  readonly members = this.identity.directory;
  readonly meId = this.identity.userId;

  /** The languages people are practising in the open rooms. */
  readonly languages = computed(() => [
    ...new Set(this.rooms()?.map((room) => room.targetLanguage)),
  ]);
  readonly shown = computed(() =>
    (this.rooms() ?? []).filter((room) => !this.filter() || room.targetLanguage === this.filter()),
  );

  reload(): void {
    this.resource.reload();
  }
}
