import { DestroyRef, effect, inject, Service, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { filter, Subject, switchMap, tap, timer, type Observable } from 'rxjs';
import { MessageService } from '@openng/optimus-ui/api';
import { ActiveRoomService } from '@core/rooms/active-room.service';
import { httpStatus } from '@shared/utils/http-status';
import { I18n } from '@shared/utils/i18n/i18n.service';
import { msg } from '@shared/utils/i18n/msg';
import { saveRequest } from '@shared/utils/save-request';
import { ParticipantsApiService } from '../data-access/participants-api.service';
import { RealtimeService } from '../data-access/realtime.service';
import { ReactionsApiService } from '../data-access/reactions-api.service';
import { RoomsApiService } from '../data-access/rooms-api.service';
import { StageApiService } from '../data-access/stage-api.service';
import type { Reaction, ReactionBurst } from '../models/reaction.model';
import type { RoomEdit } from '../models/room.model';
import { RoomStore } from './room.store';

const RECOVER_MS = 3000;
const READ_RETRY_MS = 3000;
const RECOVER_TRIES = 3;
const REACTION_SHOWN_MS = 2400;
const REACTION_COOLDOWN_MS = 500;

export type RoomExit = 'removed' | 'ended' | 'closed';

/** What the person is told when they are pushed out of the room, wherever in the app they are at that moment. */
const EXIT_MESSAGES: Readonly<Record<RoomExit, string | null>> = {
  removed: msg('The host removed you from this room.'),
  ended: msg('This room has ended.'),
  closed: null,
};

/**
 * The room the person is in. It belongs to the app, not to the room page: leaving the page for another route does not leave the room, the
 * audio keeps playing and the header shows a way back. Only leaving, being removed, or the room ending ends it.
 */
@Service()
export class RoomFacade {
  private readonly rooms = inject(RoomsApiService);
  private readonly participants = inject(ParticipantsApiService);
  private readonly stages = inject(StageApiService);
  private readonly reactions = inject(ReactionsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly active = inject(ActiveRoomService);
  private readonly toast = inject(MessageService);
  private readonly i18n = inject(I18n);
  readonly state = inject(RoomStore);
  readonly audio = inject(RealtimeService);
  private readonly pushedOut = new Subject<RoomExit>();
  private left = false;
  private announced = false;
  private recoveries = 0;
  private reactionId = 0;
  private lastReactionAt = 0;

  readonly joining = saveRequest();
  readonly action = saveRequest();
  readonly saving = saveRequest();
  readonly exited = this.pushedOut.asObservable();

  constructor() {
    this.active.onLeave(() => this.leave());
    effect(() => {
      const room = this.state.room();
      const joined = this.state.joined();
      if (joined && room) {
        this.announced = true;
        this.active.set({
          id: this.state.roomId(),
          title: room.title,
          topic: room.topic,
          targetLanguage: room.targetLanguage,
          nativeLanguage: room.nativeLanguage,
          hostName: this.state.members().get(room.hostId)?.name ?? '',
          participantCount: room.participantCount,
          speakers: this.state.speakers().length,
          seats: room.maxStageSeats,
        });
      } else if (this.announced) {
        // Cleared only once the room has been announced and then left: while a room is being rejoined after a reload it is not "left".
        this.announced = false;
        this.active.set(null);
      }
    });
    effect(() => {
      if (this.state.roomGone()) {
        untracked(() => this.exit('ended'));
      }
    });
    const audioStatus = toObservable(this.audio.status);
    // The room is read once the link to its events is up (or has failed before it ever was, so the page still shows), and again each time
    // the link comes back after a break: that is when events may have been missed. Otherwise the events keep it current.
    audioStatus
      .pipe(
        filter((status) => status === 'connected' || (status === 'failed' && !this.state.ready())),
        takeUntilDestroyed(),
      )
      .subscribe((status) => {
        if (status === 'connected') {
          this.recoveries = 0;
        }
        this.state.sync();
      });
    // A read that failed is tried again, since nothing else would: the events only keep a room current once it has been read.
    toObservable(this.state.readFailed)
      .pipe(
        filter(Boolean),
        switchMap(() => timer(READ_RETRY_MS)),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.state.sync());
    audioStatus
      .pipe(
        filter(
          (status) => status === 'failed' && this.state.joined() && this.recoveries < RECOVER_TRIES,
        ),
        tap(() => this.recoveries++),
        switchMap(() => timer(RECOVER_MS)),
        filter(() => this.state.joined() && this.audio.status() === 'failed'),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.reconnectAudio());
    this.audio.roomEvents
      .pipe(takeUntilDestroyed())
      .subscribe((update) =>
        update.type === 'REACTIONS'
          ? this.showReactions(update.reactions)
          : this.state.apply(update),
      );
    inject(DestroyRef).onDestroy(() => this.leave());
  }

  /** Opens a room. Coming back to the room already joined changes nothing; asking for another one leaves the first. */
  enter(id: string): void {
    if (this.state.roomId() === id && (this.state.joined() || this.joining.submitting())) {
      return;
    }
    if (this.state.joined()) {
      this.leave();
    }
    this.left = false;
    this.state.show(id);
    this.joining.run(this.participants.join(id), {
      next: (session) => {
        this.state.markJoined(true);
        void this.audio.connect(session);
      },
      failure: (error) => {
        // A room that could not be joined is not one to go back to after a reload.
        this.active.set(null);
        return httpStatus(error) === 403
          ? msg('The host removed you from this room.')
          : httpStatus(error) === 404
            ? msg('This room has ended.')
            : msg('Could not join the room. Please try again.');
      },
    });
  }

  leave(): void {
    void this.audio.disconnect();
    if (this.state.joined() && !this.left) {
      this.left = true;
      this.participants.leave(this.state.roomId()).subscribe({ error: () => undefined });
      this.state.markJoined(false);
    }
  }

  react(reaction: Reaction): void {
    const now = Date.now();
    if (!this.state.joined() || now - this.lastReactionAt < REACTION_COOLDOWN_MS) {
      return;
    }
    this.lastReactionAt = now;
    this.reactions.react(this.state.roomId(), reaction).subscribe({ error: () => undefined });
  }

  raiseHand(): void {
    this.run(
      this.stages.raiseHand(this.state.roomId()),
      msg('Could not raise your hand. Please try again.'),
    );
  }

  lowerHand(): void {
    this.run(
      this.stages.lowerHand(this.state.roomId()),
      msg('Could not lower your hand. Please try again.'),
    );
  }

  takeSeat(): void {
    this.run(
      this.stages.takeSeat(this.state.roomId()),
      msg('Could not take the seat. Please try again.'),
    );
  }

  stepDown(): void {
    this.run(
      this.stages.leaveSeat(this.state.roomId()),
      msg('Could not step down. Please try again.'),
    );
  }

  invite(userId: string): void {
    this.run(
      this.stages.promote(this.state.roomId(), userId),
      msg('Could not invite them. Please try again.'),
    );
  }

  demote(userId: string): void {
    this.run(
      this.stages.demote(this.state.roomId(), userId),
      msg('Could not move them. Please try again.'),
    );
  }

  mute(userId: string): void {
    this.run(
      this.stages.mute(this.state.roomId(), userId),
      msg('Could not mute them. Please try again.'),
    );
  }

  remove(userId: string): void {
    this.run(
      this.participants.remove(this.state.roomId(), userId),
      msg('Could not remove them. Please try again.'),
    );
  }

  close(): void {
    this.run(
      this.rooms.close(this.state.roomId()),
      msg('Could not end the room. Please try again.'),
      () => this.exit('closed'),
    );
  }

  edit(change: RoomEdit, done: () => void): void {
    this.saving.run(this.rooms.update(this.state.roomId(), change), {
      next: ({ title, topic, maxStageSeats }) => {
        this.state.apply({ type: 'ROOM_UPDATED', title, topic, maxStageSeats });
        done();
      },
      failure: msg('Could not save the room. Please try again.'),
    });
  }

  reconnectAudio(): void {
    this.participants.join(this.state.roomId()).subscribe({
      next: (session) => void this.audio.connect(session),
      error: (error: unknown) => this.exitIfPushedOut(error),
    });
  }

  private showReactions(bursts: readonly ReactionBurst[]): void {
    const shown = bursts.map((burst) => ({ ...burst, id: ++this.reactionId }));
    this.state.float(shown);
    timer(REACTION_SHOWN_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.state.settle(new Set(shown.map((reaction) => reaction.id))));
  }

  private exitIfPushedOut(error: unknown): void {
    if (httpStatus(error) === 403) {
      this.exit('removed');
    } else if (httpStatus(error) === 404) {
      this.exit('ended');
    }
  }

  private run(request: Observable<void>, failure: string, after?: () => void): void {
    this.action.run(request, {
      next: () => after?.(),
      failure,
    });
  }

  private exit(reason: RoomExit): void {
    if (this.left) {
      return;
    }
    this.left = true;
    this.state.markJoined(false);
    void this.audio.disconnect();
    const summary = EXIT_MESSAGES[reason];
    if (summary) {
      this.toast.add({ severity: 'warn', summary: this.i18n.t(summary) });
    }
    this.pushedOut.next(reason);
  }
}
