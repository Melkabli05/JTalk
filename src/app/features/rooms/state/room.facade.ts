import { DestroyRef, effect, inject, Service, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { filter, Subject, switchMap, tap, timer, type Observable } from 'rxjs';
import { MessageService } from '@openng/optimus-ui/api';
import { ActiveRoomService } from '@core/rooms/active-room.service';
import { httpStatus } from '@shared/utils/http-status';
import { saveRequest } from '@shared/utils/save-request';
import { ChatApiService } from '../data-access/chat-api.service';
import { ParticipantsApiService } from '../data-access/participants-api.service';
import { RealtimeService } from '../data-access/realtime.service';
import { ReactionsApiService } from '../data-access/reactions-api.service';
import { RoomsApiService } from '../data-access/rooms-api.service';
import { StageApiService } from '../data-access/stage-api.service';
import type { CommentDraft } from '../models/chat.model';
import type { Reaction, ReactionBurst } from '../models/reaction.model';
import type { RoomEdit } from '../models/room.model';
import { RoomChatStore } from './room-chat.store';
import { RoomStore } from './room.store';

const RECOVER_MS = 3000;
const READ_RETRY_MS = 3000;
const RECOVER_TRIES = 3;
const REACTION_SHOWN_MS = 2400;
const REACTION_COOLDOWN_MS = 500;

export type RoomExit = 'removed' | 'ended' | 'closed';

/** What the person is told when they are pushed out of the room, wherever in the app they are at that moment. */
const EXIT_MESSAGES: Readonly<Record<RoomExit, string | null>> = {
  removed: 'The host removed you from this room.',
  ended: 'This room has ended.',
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
  private readonly chats = inject(ChatApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly active = inject(ActiveRoomService);
  private readonly toast = inject(MessageService);
  readonly state = inject(RoomStore);
  readonly chat = inject(RoomChatStore);
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
  readonly commenting = saveRequest();
  readonly moderating = saveRequest();
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
          targetLanguage: room.targetLanguage,
          nativeLanguage: room.nativeLanguage,
          hostId: room.hostId,
          hostName: this.state.members().get(room.hostId)?.name ?? '',
          hostAvatar: this.state.members().get(room.hostId)?.avatar ?? '',
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
        this.chat.reload();
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
    this.audio.chatEvents.pipe(takeUntilDestroyed()).subscribe((update) => this.chat.apply(update));
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
          ? 'The host removed you from this room.'
          : httpStatus(error) === 404
            ? 'This room has ended.'
            : 'Could not join the room. Please try again.';
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

  sendComment(draft: CommentDraft): void {
    this.commenting.run(this.chats.post(this.state.roomId(), draft), {
      next: (comment) => this.chat.posted(comment),
      failure: (error) => {
        const status = httpStatus(error);
        return status === 429
          ? 'Wait a moment before commenting again.'
          : status === 403
            ? 'You cannot comment right now.'
            : status === 400
              ? 'That comment cannot be sent.'
              : 'Could not send the comment. Please try again.';
      },
    });
  }

  /** Reacts to a comment with this, or takes the reaction back when it is already the person's own. The comment shows it once the service says it is kept. */
  reactToComment(commentId: string, reaction: Reaction): void {
    const taking = this.chat.reactions().get(commentId)?.mine === reaction;
    const request = taking
      ? this.chats.unreact(this.state.roomId(), commentId)
      : this.chats.react(this.state.roomId(), commentId, reaction);
    request.subscribe({
      next: () => this.chat.chose(commentId, taking ? null : reaction),
      error: () => undefined,
    });
  }

  deleteComment(commentId: string): void {
    this.moderating.run(this.chats.remove(this.state.roomId(), commentId), {
      next: () => this.chat.removed(commentId),
      failure: 'Could not delete the comment. Please try again.',
    });
  }

  muteInChat(userId: string): void {
    this.moderating.run(this.chats.mute(this.state.roomId(), userId), {
      next: () => undefined,
      failure: 'Could not mute them in the chat. Please try again.',
    });
  }

  unmuteInChat(userId: string): void {
    this.moderating.run(this.chats.unmute(this.state.roomId(), userId), {
      next: () => undefined,
      failure: 'Could not unmute them in the chat. Please try again.',
    });
  }

  pinTopic(text: string): void {
    this.moderating.run(this.chats.pinTopic(this.state.roomId(), text), {
      next: () => undefined,
      failure: 'Could not pin the topic. Please try again.',
    });
  }

  clearTopic(): void {
    this.moderating.run(this.chats.clearTopic(this.state.roomId()), {
      next: () => undefined,
      failure: 'Could not clear the topic. Please try again.',
    });
  }

  pinComment(commentId: string): void {
    this.moderating.run(this.chats.pinComment(this.state.roomId(), commentId), {
      next: () => undefined,
      failure: 'Could not pin the comment. Please try again.',
    });
  }

  unpinComment(commentId: string): void {
    this.moderating.run(this.chats.unpinComment(this.state.roomId(), commentId), {
      next: () => undefined,
      failure: 'Could not unpin the comment. Please try again.',
    });
  }

  raiseHand(): void {
    this.run(
      this.stages.raiseHand(this.state.roomId()),
      'Could not raise your hand. Please try again.',
    );
  }

  lowerHand(): void {
    this.run(
      this.stages.lowerHand(this.state.roomId()),
      'Could not lower your hand. Please try again.',
    );
  }

  takeSeat(): void {
    this.run(
      this.stages.takeSeat(this.state.roomId()),
      'Could not take the seat. Please try again.',
    );
  }

  stepDown(): void {
    this.run(this.stages.leaveSeat(this.state.roomId()), 'Could not step down. Please try again.');
  }

  invite(userId: string): void {
    this.run(
      this.stages.promote(this.state.roomId(), userId),
      'Could not invite them. Please try again.',
    );
  }

  demote(userId: string): void {
    this.run(
      this.stages.demote(this.state.roomId(), userId),
      'Could not move them. Please try again.',
    );
  }

  mute(userId: string): void {
    this.run(
      this.stages.mute(this.state.roomId(), userId),
      'Could not mute them. Please try again.',
    );
  }

  remove(userId: string): void {
    this.run(
      this.participants.remove(this.state.roomId(), userId),
      'Could not remove them. Please try again.',
    );
  }

  close(): void {
    this.run(
      this.rooms.close(this.state.roomId()),
      'Could not end the room. Please try again.',
      () => this.exit('closed'),
    );
  }

  edit(change: RoomEdit, done: () => void): void {
    this.saving.run(this.rooms.update(this.state.roomId(), change), {
      next: ({ title, topic, maxStageSeats }) => {
        this.state.apply({ type: 'ROOM_UPDATED', title, topic, maxStageSeats });
        done();
      },
      failure: 'Could not save the room. Please try again.',
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
      this.toast.add({ severity: 'warn', summary: summary });
    }
    this.pushedOut.next(reason);
  }
}
