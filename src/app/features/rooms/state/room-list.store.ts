import { computed, inject, Service, signal } from '@angular/core';
import { IdentityService } from '@core/auth/identity.service';
import { loadedValue } from '@shared/utils/resource-value';
import { RoomsApiService } from '../data-access/rooms-api.service';

@Service()
export class RoomListStore {
  private readonly api = inject(RoomsApiService);
  private readonly identity = inject(IdentityService);

  private readonly resource = this.api.roomsResource();

  readonly rooms = loadedValue(this.resource);
  readonly failed = computed(() => this.resource.error() !== undefined);
  readonly filter = signal('');

  readonly members = this.identity.directory;
  readonly meId = this.identity.userId;

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
