import { computed, inject, Service, signal } from '@angular/core';
import { IdentityService } from '@core/auth/identity.service';
import { httpStatus } from '@shared/utils/http-status';
import { loadedValue } from '@shared/utils/resource-value';
import { ParticipantsApiService } from '../data-access/participants-api.service';
import { RoomsApiService } from '../data-access/rooms-api.service';
import { StageApiService } from '../data-access/stage-api.service';

/**
 * The state of the room the person is in: what the server says about it (the room, the stage, who is present), whether
 * this person has joined, and what follows (who hosts, speaks and listens, and who this person is among them). Signals
 * and nothing else: `RoomFacade` is what changes it. Provide it, with the facade, per room page.
 */
@Service()
export class RoomStore {
  private readonly rooms = inject(RoomsApiService);
  private readonly participants = inject(ParticipantsApiService);
  private readonly stages = inject(StageApiService);
  private readonly identity = inject(IdentityService);

  private readonly id = signal('');
  private readonly hasJoined = signal(false);

  /** The room being shown; empty until the page names one, and the resources wait while it is. */
  readonly roomId = this.id.asReadonly();
  /** This person has been let in (the server may not list them as present for a moment yet). */
  readonly joined = this.hasJoined.asReadonly();

  private readonly roomResource = this.rooms.roomResource(this.roomId);
  private readonly stageResource = this.stages.stageResource(this.roomId);
  private readonly peopleResource = this.participants.participantsResource(this.roomId);

  readonly room = loadedValue(this.roomResource);
  readonly stage = loadedValue(this.stageResource);
  /** The server no longer has this room. */
  readonly roomGone = computed(() => httpStatus(this.roomResource.error()) === 404);

  /** Everyone the app knows by name, and who this person is. */
  readonly members = this.identity.directory;
  readonly meId = this.identity.userId;

  readonly hostId = computed(() => this.room()?.hostId ?? '');
  readonly isHost = computed(() => this.meId() !== null && this.meId() === this.hostId());
  readonly speakers = computed(() => this.stage()?.speakers ?? []);
  readonly queue = computed(() => this.stage()?.handRaiseQueue ?? []);
  readonly onStage = computed(() => this.speakers().includes(this.meId() ?? ''));
  readonly handRaised = computed(() => this.queue().includes(this.meId() ?? ''));

  private readonly present = loadedValue(this.peopleResource);
  /** Everyone present who is not on stage, and this person from the moment they are in. */
  readonly audience = computed(() => {
    const ids = new Set(this.present()?.map((person) => person.userId));
    const me = this.meId();
    if (this.joined() && me) {
      ids.add(me);
    }
    return [...ids].filter((id) => !this.speakers().includes(id));
  });
  /** Speakers whose media dropped and whose seat is being held. */
  readonly reconnecting = computed(
    () =>
      this.present()
        ?.filter((person) => person.reconnecting)
        .map((person) => person.userId) ?? [],
  );

  /** Shows another room: forgets that this person had joined, and the resources fetch the new one. */
  show(id: string): void {
    this.hasJoined.set(false);
    this.id.set(id);
  }

  markJoined(joined: boolean): void {
    this.hasJoined.set(joined);
  }

  /** Fetches the room, the stage and who is present again. */
  reload(): void {
    this.roomResource.reload();
    this.stageResource.reload();
    this.peopleResource.reload();
  }
}
