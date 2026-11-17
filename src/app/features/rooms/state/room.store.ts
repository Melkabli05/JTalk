import { computed, inject, linkedSignal, Service, signal } from '@angular/core';
import { IdentityService } from '@core/auth/identity.service';
import { httpStatus } from '@shared/utils/http-status';
import { loadedValue } from '@shared/utils/resource-value';
import { ParticipantsApiService } from '../data-access/participants-api.service';
import { RoomsApiService } from '../data-access/rooms-api.service';
import { StageApiService } from '../data-access/stage-api.service';
import type { RoomUpdate } from '../models/realtime.model';
import type { Participant } from '../models/room.model';

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

  private readonly roomState = linkedSignal(loadedValue(this.roomResource));
  private readonly stageState = linkedSignal(loadedValue(this.stageResource));
  private readonly peopleState = linkedSignal(loadedValue(this.peopleResource));
  private stageStamp = 0;

  readonly room = this.roomState.asReadonly();
  readonly stage = this.stageState.asReadonly();
  readonly roomGone = computed(() => httpStatus(this.roomResource.error()) === 404);

  readonly members = this.identity.directory;
  readonly meId = this.identity.userId;

  readonly hostId = computed(() => this.room()?.hostId ?? '');
  readonly isHost = computed(() => this.meId() !== null && this.meId() === this.hostId());
  readonly speakers = computed(() => this.stage()?.speakers ?? []);
  readonly queue = computed(() => this.stage()?.handRaiseQueue ?? []);
  readonly onStage = computed(() => this.speakers().includes(this.meId() ?? ''));
  readonly handRaised = computed(() => this.queue().includes(this.meId() ?? ''));

  readonly audience = computed(() => {
    const ids = new Set(this.peopleState()?.map((person) => person.userId));
    const me = this.meId();
    if (this.joined() && me) {
      ids.add(me);
    }
    return [...ids].filter((id) => !this.speakers().includes(id));
  });
  readonly reconnecting = computed(
    () =>
      this.peopleState()
        ?.filter((person) => person.reconnecting)
        .map((person) => person.userId) ?? [],
  );

  show(id: string): void {
    this.hasJoined.set(false);
    this.stageStamp = 0;
    this.id.set(id);
  }

  markJoined(joined: boolean): void {
    this.hasJoined.set(joined);
  }

  apply(update: RoomUpdate): void {
    switch (update.type) {
      case 'STAGE_UPDATED':
      case 'HAND_RAISED':
      case 'HAND_LOWERED':
        if (update.at >= this.stageStamp) {
          this.stageStamp = update.at;
          this.stageState.set(update.stage);
          this.roomState.update(
            (room) =>
              room && {
                ...room,
                speakers: update.stage.speakers,
                handRaiseCount: update.stage.handRaiseQueue.length,
              },
          );
        }
        break;
      case 'SPEAKER_RECONNECTING':
      case 'SPEAKER_RECONNECTED':
        this.peopleState.update((people) =>
          people?.map((person) =>
            person.userId === update.userId
              ? { ...person, reconnecting: update.type === 'SPEAKER_RECONNECTING' }
              : person,
          ),
        );
        break;
      case 'PRESENCE_CHANGED':
        this.peopleState.update((people) => people && arrivals(people, update.joined, update.left));
        this.roomState.update(
          (room) => room && { ...room, participantCount: update.participantCount },
        );
        break;
    }
  }

  reload(): void {
    this.roomResource.reload();
    this.stageResource.reload();
    this.peopleResource.reload();
  }
}

function arrivals(
  people: readonly Participant[],
  joined: readonly string[],
  left: readonly string[],
): Participant[] {
  const gone = new Set(left);
  const known = new Set(people.map((person) => person.userId));
  return [
    ...people.filter((person) => !gone.has(person.userId)),
    ...joined
      .filter((userId) => !known.has(userId))
      .map((userId) => ({ userId, reconnecting: false })),
  ];
}
