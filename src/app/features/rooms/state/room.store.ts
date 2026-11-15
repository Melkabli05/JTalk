import { computed, Service, signal, inject } from '@angular/core';
import { IdentityService } from '@core/auth/identity.service';
import { ParticipantsApiService } from '../data-access/participants-api.service';
import { RoomsApiService } from '../data-access/rooms-api.service';
import { StageApiService } from '../data-access/stage-api.service';

/**
 * The state of the room the person is in: what the server says about it (the room, the stage, who is present), whether
 * this person has joined, and what follows from those (who is hosting, speaking, listening, who this person is in it).
 * Plain signals and no behavior: `RoomFacade` is what changes it. Provide it, with the facade, per room page.
 */
@Service()
export class RoomStore {
  private readonly rooms = inject(RoomsApiService);
  private readonly participants = inject(ParticipantsApiService);
  private readonly stages = inject(StageApiService);
  private readonly identity = inject(IdentityService);

  private readonly currentId = signal('');
  private readonly hasJoined = signal(false);

  /** The room being shown; empty until the page names one. */
  readonly roomId = this.currentId.asReadonly();
  /** This person has been let in (they may not be listed as present for a moment yet). */
  readonly joined = this.hasJoined.asReadonly();

  // What the server says. Each resource follows `roomId`, and waits while it is empty.
  readonly room = this.rooms.roomResource(this.roomId);
  readonly stage = this.stages.stageResource(this.roomId);
  readonly people = this.participants.participantsResource(this.roomId);

  /** Everyone the app knows by name, and who this person is. */
  readonly members = this.identity.directory;
  readonly meId = this.identity.userId;

  readonly hostId = computed(() => (this.room.hasValue() ? this.room.value().hostId : ''));
  readonly isHost = computed(() => this.meId() !== null && this.meId() === this.hostId());
  readonly speakers = computed(() => (this.stage.hasValue() ? this.stage.value().speakers : []));
  readonly queue = computed(() => (this.stage.hasValue() ? this.stage.value().handRaiseQueue : []));
  readonly onStage = computed(() => this.speakers().includes(this.meId() ?? ''));
  readonly handRaised = computed(() => this.queue().includes(this.meId() ?? ''));

  private readonly present = computed(() => (this.people.hasValue() ? this.people.value() : []));
  /** Everyone present who is not on stage, and this person from the moment they are in. */
  readonly audience = computed(() => {
    const ids = new Set(this.present().map((person) => person.userId));
    const me = this.meId();
    if (this.joined() && me) {
      ids.add(me);
    }
    return [...ids].filter((id) => !this.speakers().includes(id));
  });
  /** Speakers whose media dropped and whose seat is being held. */
  readonly reconnecting = computed(() =>
    this.present()
      .filter((person) => person.reconnecting)
      .map((person) => person.userId),
  );

  /** Starts on another room: forgets that this person had joined, and the resources fetch the new one. */
  show(id: string): void {
    this.hasJoined.set(false);
    this.currentId.set(id);
  }

  markJoined(joined: boolean): void {
    this.hasJoined.set(joined);
  }

  /** Fetches the room, the stage and who is present again. */
  reload(): void {
    this.room.reload();
    this.stage.reload();
    this.people.reload();
  }
}
