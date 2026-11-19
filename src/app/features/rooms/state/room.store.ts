import { computed, effect, inject, linkedSignal, Service, signal, untracked } from '@angular/core';
import { IdentityService } from '@core/auth/identity.service';
import { httpStatus } from '@shared/utils/http-status';
import { loadedValue } from '@shared/utils/resource-value';
import { ParticipantsApiService } from '../data-access/participants-api.service';
import { RoomsApiService } from '../data-access/rooms-api.service';
import { StageApiService } from '../data-access/stage-api.service';
import type { FloatingReaction } from '../models/reaction.model';
import type { RoomUpdate } from '../models/realtime.model';
import type { Participant } from '../models/room.model';

const MAX_FLOATING = 40;

@Service()
export class RoomStore {
  private readonly rooms = inject(RoomsApiService);
  private readonly participants = inject(ParticipantsApiService);
  private readonly stages = inject(StageApiService);
  private readonly identity = inject(IdentityService);

  private readonly id = signal('');
  private readonly hasJoined = signal(false);
  // The room is read from the server once the link to its live events is up, so nothing that happens after it is missed; from then on the
  // events keep it current, and it is read again only when the link comes back after a break.
  private readonly reading = signal(false);
  readonly readId = computed(() => (this.reading() ? this.id() : ''));

  readonly roomId = this.id.asReadonly();
  readonly joined = this.hasJoined.asReadonly();

  private readonly roomResource = this.rooms.roomResource(this.readId);
  private readonly stageResource = this.stages.stageResource(this.readId);
  private readonly peopleResource = this.participants.participantsResource(this.readId);

  private readonly roomState = linkedSignal(loadedValue(this.roomResource));
  private readonly stageState = linkedSignal(loadedValue(this.stageResource));
  private readonly peopleState = linkedSignal(loadedValue(this.peopleResource));
  private stageStamp = 0;
  private readonly floatingState = signal<readonly FloatingReaction[]>([]);

  readonly room = this.roomState.asReadonly();
  readonly stage = this.stageState.asReadonly();
  /** The room, the stage and who is here have all been read. */
  readonly ready = computed(
    () =>
      this.roomState() !== undefined &&
      this.stageState() !== undefined &&
      this.peopleState() !== undefined,
  );
  readonly floating = this.floatingState.asReadonly();
  readonly reactionsByPerson = computed(
    () => new Map(this.floating().map((reaction) => [reaction.userId, reaction])),
  );
  readonly roomGone = computed(() => httpStatus(this.roomResource.error()) === 404);
  /** Reading the room failed for a reason that trying again can fix (a room that is gone is not one). */
  readonly readFailed = computed(() =>
    [this.roomResource, this.stageResource, this.peopleResource].some((resource) => {
      const error: unknown = resource.error();
      return error !== undefined && httpStatus(error) !== 404;
    }),
  );
  private readonly loadingRoom = computed(
    () =>
      this.roomResource.isLoading() ||
      this.stageResource.isLoading() ||
      this.peopleResource.isLoading(),
  );
  // What arrives while the room is being read may be older or newer than what the read returns, and the read would overwrite it. So it is
  // applied when it arrives, and again, in order, once the read is done: applying an event twice changes nothing.
  private missed: RoomUpdate[] = [];
  private readonly replay = effect(() => {
    if (!this.loadingRoom() && this.missed.length > 0) {
      const events = this.missed;
      this.missed = [];
      untracked(() => events.forEach((update) => this.change(update)));
    }
  });

  readonly members = this.identity.directory;

  // Everyone in the room, on the stage or in the audience: names and pictures come from the user service, in one call per change.
  private readonly lookup = effect(() => {
    this.identity.resolve([
      this.hostId(),
      ...this.speakers(),
      ...this.queue(),
      ...(this.peopleState() ?? []).map((person) => person.userId),
    ]);
  });
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
    this.reading.set(false);
    this.stageStamp = 0;
    this.floatingState.set([]);
    this.id.set(id);
  }

  markJoined(joined: boolean): void {
    this.hasJoined.set(joined);
  }

  apply(update: RoomUpdate): void {
    if (this.loadingRoom()) {
      this.missed.push(update);
    }
    this.change(update);
  }

  private change(update: RoomUpdate): void {
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
      case 'ROOM_UPDATED':
        this.roomState.update(
          (room) =>
            room && {
              ...room,
              title: update.title,
              topic: update.topic,
              maxStageSeats: update.maxStageSeats,
              hostId: update.hostId ?? room.hostId,
            },
        );
        break;
      case 'PRESENCE_CHANGED':
        this.peopleState.update((people) => people && arrivals(people, update.joined, update.left));
        this.roomState.update(
          (room) => room && { ...room, participantCount: update.participantCount },
        );
        break;
      case 'PARTICIPANT_PROFILE_UPDATED':
        this.identity.updateUserAvatar(update.userId, update.avatarUrl);
        break;
    }
  }

  float(reactions: readonly FloatingReaction[]): void {
    this.floatingState.update((current) => [...current, ...reactions].slice(-MAX_FLOATING));
  }

  settle(ids: ReadonlySet<number>): void {
    this.floatingState.update((current) => current.filter((reaction) => !ids.has(reaction.id)));
  }

  /** Reads the room, the stage and who is here: the first time this starts it, after that it reads them again. */
  sync(): void {
    if (!this.reading()) {
      this.reading.set(true);
      return;
    }
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
