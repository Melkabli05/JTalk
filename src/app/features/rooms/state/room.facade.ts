import { DestroyRef, effect, inject, Service, untracked, type Provider } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, Subject, type Observable } from 'rxjs';
import { httpStatus } from '@shared/utils/http-status';
import { msg } from '@shared/utils/i18n/msg';
import { saveRequest } from '@shared/utils/save-request';
import { ParticipantsApiService } from '../data-access/participants-api.service';
import { RealtimeService } from '../data-access/realtime.service';
import { RoomsApiService } from '../data-access/rooms-api.service';
import { StageApiService } from '../data-access/stage-api.service';
import type { RoomEdit } from '../models/room.model';
import { RoomStore } from './room.store';

const REFRESH_MS = 3000;

export type RoomExit = 'removed' | 'ended' | 'closed';

@Service()
export class RoomFacade {
  private readonly rooms = inject(RoomsApiService);
  private readonly participants = inject(ParticipantsApiService);
  private readonly stages = inject(StageApiService);
  readonly state = inject(RoomStore);
  readonly audio = inject(RealtimeService);
  private readonly pushedOut = new Subject<RoomExit>();
  private left = false;

  readonly joining = saveRequest();
  readonly action = saveRequest();
  readonly saving = saveRequest();
  readonly exited = this.pushedOut.asObservable();

  constructor() {
    effect(() => {
      if (this.state.roomGone()) {
        untracked(() => this.exit('ended'));
      }
    });
    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.refresh());
    this.audio.roomEvents.pipe(takeUntilDestroyed()).subscribe(() => this.state.reload());
    inject(DestroyRef).onDestroy(() => this.leave());
  }

  enter(id: string): void {
    this.left = false;
    this.state.show(id);
    this.joining.run(this.participants.join(id), {
      next: (session) => {
        this.state.markJoined(true);
        void this.audio.connect(session);
      },
      failure: (error) =>
        httpStatus(error) === 403
          ? msg('The host removed you from this room.')
          : httpStatus(error) === 404
            ? msg('This room has ended.')
            : msg('Could not join the room. Please try again.'),
    });
  }

  leave(): void {
    void this.audio.disconnect();
    if (this.state.joined() && !this.left) {
      this.left = true;
      this.participants.leave(this.state.roomId()).subscribe({ error: () => undefined });
    }
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
      next: () => {
        this.state.reload();
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

  private refresh(): void {
    if (!this.state.joined()) {
      return;
    }
    this.participants.heartbeat(this.state.roomId()).subscribe({
      error: (error: unknown) => this.exitIfPushedOut(error),
    });
    this.state.reload();
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
      next: () => {
        after?.();
        this.state.reload();
      },
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
    this.pushedOut.next(reason);
  }
}

export function provideRoom(): Provider[] {
  return [RoomStore, RealtimeService, RoomFacade];
}
