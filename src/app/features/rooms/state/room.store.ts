import { computed, inject, Service, signal } from '@angular/core';
import { IdentityService } from '@core/auth/identity.service';
import { httpStatus } from '@shared/utils/http-status';
import { loadedValue } from '@shared/utils/resource-value';
import { ParticipantsApiService } from '../data-access/participants-api.service';
import { RoomsApiService } from '../data-access/rooms-api.service';
import { StageApiService } from '../data-access/stage-api.service';

@Service()
export class RoomStore {
  private readonly rooms = inject(RoomsApiService);
  private readonly participants = inject(ParticipantsApiService);
  private readonly stages = inject(StageApiService);
  private readonly identity = inject(IdentityService);

  private readonly id = signal('');
  private readonly hasJoined = signal(false);

  readonly roomId = this.id.asReadonly();
  readonly joined = this.hasJoined.asReadonly();

  private readonly roomResource = this.rooms.roomResource(this.roomId);
  private readonly stageResource = this.stages.stageResource(this.roomId);
  private readonly peopleResource = this.participants.participantsResource(this.roomId);

  readonly room = loadedValue(this.roomResource);
  readonly stage = loadedValue(this.stageResource);
  readonly roomGone = computed(() => httpStatus(this.roomResource.error()) === 404);

  readonly members = this.identity.directory;
  readonly meId = this.identity.userId;

  readonly hostId = computed(() => this.room()?.hostId ?? '');
  readonly isHost = computed(() => this.meId() !== null && this.meId() === this.hostId());
  readonly speakers = computed(() => this.stage()?.speakers ?? []);
  readonly queue = computed(() => this.stage()?.handRaiseQueue ?? []);
  readonly onStage = computed(() => this.speakers().includes(this.meId() ?? ''));
  readonly handRaised = computed(() => this.queue().includes(this.meId() ?? ''));

  private readonly present = loadedValue(this.peopleResource);
  readonly audience = computed(() => {
    const ids = new Set(this.present()?.map((person) => person.userId));
    const me = this.meId();
    if (this.joined() && me) {
      ids.add(me);
    }
    return [...ids].filter((id) => !this.speakers().includes(id));
  });
  readonly reconnecting = computed(
    () =>
      this.present()
        ?.filter((person) => person.reconnecting)
        .map((person) => person.userId) ?? [],
  );

  show(id: string): void {
    this.hasJoined.set(false);
    this.id.set(id);
  }

  markJoined(joined: boolean): void {
    this.hasJoined.set(joined);
  }

  reload(): void {
    this.roomResource.reload();
    this.stageResource.reload();
    this.peopleResource.reload();
  }
}
