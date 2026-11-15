import { computed, inject, Service, signal } from '@angular/core';
import { IdentityService } from '@core/auth/identity.service';
import { RoomsApiService } from '../data-access/rooms-api.service';

/**
 * The state of the hallway: the open rooms the server lists, the language the person narrowed them to, and what follows
 * (which languages there are, which rooms to show). `RoomsFacade` changes it. Provide it, with the facade, per page.
 */
@Service()
export class RoomsStore {
  private readonly api = inject(RoomsApiService);
  private readonly identity = inject(IdentityService);

  private readonly chosenLanguage = signal('');

  readonly rooms = this.api.roomsResource();
  /** Everyone the app knows by name, and who this person is. */
  readonly members = this.identity.directory;
  readonly meId = this.identity.userId;
  /** The language the list is narrowed to; empty shows every room. */
  readonly filter = this.chosenLanguage.asReadonly();

  private readonly all = computed(() => (this.rooms.hasValue() ? this.rooms.value() : []));
  /** The languages people are practising in the open rooms. */
  readonly languages = computed(() => [...new Set(this.all().map((room) => room.targetLanguage))]);
  readonly shown = computed(() =>
    this.all().filter((room) => !this.filter() || room.targetLanguage === this.filter()),
  );

  setFilter(language: string): void {
    this.chosenLanguage.set(language);
  }

  reload(): void {
    this.rooms.reload();
  }
}
