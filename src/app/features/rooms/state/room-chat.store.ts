import { computed, effect, inject, linkedSignal, Service, signal, untracked } from '@angular/core';
import { IdentityService } from '@core/auth/identity.service';
import { loadedValue } from '@shared/utils/resource-value';
import { ChatApiService } from '../data-access/chat-api.service';
import {
  COMMENTS_KEPT,
  type ChatUpdate,
  type CommentTally,
  type RoomComment,
} from '../models/chat.model';
import type { Reaction } from '../models/reaction.model';
import { withReaction } from '../utils/comment-reactions';
import { RoomStore } from './room.store';

@Service()
export class RoomChatStore {
  private readonly api = inject(ChatApiService);
  private readonly room = inject(RoomStore);
  private readonly identity = inject(IdentityService);

  private readonly resource = this.api.chatResource(this.room.readId);
  private readonly loaded = loadedValue(this.resource);

  private readonly commentsState = linkedSignal<readonly RoomComment[]>(
    () => this.loaded()?.comments ?? [],
  );
  private readonly topicState = linkedSignal<string | null>(() => this.loaded()?.topic ?? null);
  private readonly mutedState = linkedSignal(() => this.loaded()?.muted ?? false);
  private readonly mutedUsersState = linkedSignal<readonly string[]>(
    () => this.loaded()?.mutedUsers ?? [],
  );
  private readonly reactionsState = linkedSignal<ReadonlyMap<string, CommentTally>>(
    () => this.loaded()?.reactions ?? new Map(),
  );
  private readonly unreadState = signal(0);
  private readonly watching = signal(false);
  private missed: ChatUpdate[] = [];

  readonly comments = this.commentsState.asReadonly();
  readonly topic = this.topicState.asReadonly();
  readonly muted = this.mutedState.asReadonly();
  readonly mutedUsers = this.mutedUsersState.asReadonly();
  readonly reactions = this.reactionsState.asReadonly();
  readonly unread = this.unreadState.asReadonly();
  readonly ready = computed(() => this.loaded() !== undefined);
  readonly failed = computed(() => this.resource.error() !== undefined);
  readonly members = this.identity.directory;
  readonly meId = this.identity.userId;

  private readonly lookup = effect(() => {
    this.identity.resolve(this.comments().map((comment) => comment.authorId));
  });

  private readonly replay = effect(() => {
    if (!this.resource.isLoading() && this.missed.length > 0) {
      const events = this.missed;
      this.missed = [];
      untracked(() => events.forEach((update) => this.change(update)));
    }
  });

  private readonly reset = effect(() => {
    this.room.roomId();
    untracked(() => {
      this.unreadState.set(0);
      this.watching.set(false);
      this.missed = [];
    });
  });

  apply(update: ChatUpdate): void {
    if (this.resource.isLoading()) {
      this.missed.push(update);
    }
    this.change(update);
  }

  posted(comment: RoomComment): void {
    this.add(comment);
  }

  removed(commentId: string): void {
    this.commentsState.update((list) => list.filter((comment) => comment.id !== commentId));
    this.reactionsState.update((tallies) => {
      const rest = new Map(tallies);
      rest.delete(commentId);
      return rest;
    });
  }

  /** The viewer's own reaction to a comment is now this (none: taken back). The same whether it comes from their request or their other device. */
  chose(commentId: string, reaction: Reaction | null): void {
    const previous = this.reactionsState().get(commentId)?.mine ?? null;
    if (previous !== reaction) {
      this.tally(commentId, previous, reaction, true);
    }
  }

  watch(open: boolean): void {
    this.watching.set(open);
    if (open) {
      this.unreadState.set(0);
    }
  }

  reload(): void {
    this.resource.reload();
  }

  private change(update: ChatUpdate): void {
    switch (update.type) {
      case 'COMMENT_POSTED':
        this.add(update.comment);
        if (!this.watching() && update.comment.authorId !== this.meId()) {
          this.unreadState.update((count) => count + 1);
        }
        break;
      case 'COMMENT_DELETED':
        this.removed(update.commentId);
        break;
      case 'COMMENT_REACTED':
        if (update.userId === this.meId()) {
          this.chose(update.commentId, update.reaction);
        } else {
          this.tally(update.commentId, update.previous, update.reaction, false);
        }
        break;
      case 'CHAT_MUTED':
        this.mutedUsersState.update((ids) =>
          ids.includes(update.userId) ? ids : [...ids, update.userId],
        );
        if (update.userId === this.meId()) {
          this.mutedState.set(true);
        }
        break;
      case 'CHAT_UNMUTED':
        this.mutedUsersState.update((ids) => ids.filter((id) => id !== update.userId));
        if (update.userId === this.meId()) {
          this.mutedState.set(false);
        }
        break;
      case 'TOPIC_CHANGED':
        this.topicState.set(update.topic);
        break;
    }
  }

  private tally(
    commentId: string,
    previous: Reaction | null,
    next: Reaction | null,
    own: boolean,
  ): void {
    this.reactionsState.update((tallies) => {
      const changed = withReaction(tallies.get(commentId), previous, next, own);
      const all = new Map(tallies);
      if (changed === undefined) {
        all.delete(commentId);
      } else {
        all.set(commentId, changed);
      }
      return all;
    });
  }

  private add(comment: RoomComment): void {
    this.commentsState.update((list) =>
      list.some((existing) => existing.id === comment.id)
        ? list
        : [...list, comment].slice(-COMMENTS_KEPT),
    );
  }
}
