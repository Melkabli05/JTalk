import { computed, inject, Service, signal } from '@angular/core';
import { errorMessage } from '../../../core/http/http-error.interceptor';
import {
  emojiForReaction,
  isBackendReaction,
  labelForReaction,
  type BackendReaction,
  type ChatRealtimeEvent,
  type ChatStateDto,
  type CommentReactionTallyDto,
  type RoomCommentDto,
} from '../../../shared/models/voice-room.model';
import { avatarChipClassFor } from '../../../shared/utils/avatar-chip.utils';
import { VoiceRoomApi } from '../data-access/voice-room-api';
import type {
  ActionFeedback,
  DiscussionMessage,
  MessageReaction,
} from '../models/live-room.model';
import { RoomStageStore } from './room-stage-store';

function formatTimeLabel(isoDate: string): string {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

@Service()
export class RoomChatStore {
  private readonly voiceRoomApi = inject(VoiceRoomApi);
  private readonly stageStore = inject(RoomStageStore);

  private chatRevision = 0;

  private readonly loadingState = signal(false);
  private readonly rawCommentsState = signal<readonly RoomCommentDto[]>([]);
  private readonly commentReactionsState = signal<ReadonlyMap<string, CommentReactionTallyDto>>(
    new Map(),
  );
  private readonly pinnedTopicState = signal<string | null>(null);
  private readonly pinnedCommentIds = signal<readonly string[]>([]);
  private readonly chatMutedUsersState = signal<ReadonlySet<string>>(new Set());
  private readonly isChatMutedState = signal(false);
  private readonly chatErrorState = signal(false);

  readonly loading = this.loadingState.asReadonly();
  readonly rawComments = this.rawCommentsState.asReadonly();
  readonly commentReactions = this.commentReactionsState.asReadonly();
  readonly pinnedTopic = this.pinnedTopicState.asReadonly();
  readonly pinnedCommentId = computed(() => this.pinnedCommentIds()[0] ?? null);
  readonly chatMutedUsers = this.chatMutedUsersState.asReadonly();
  readonly isChatMuted = this.isChatMutedState.asReadonly();
  readonly chatError = this.chatErrorState.asReadonly();

  private readonly reply = signal<{
    author: string;
    commentId: string | null;
    original: string | null;
  } | null>(null);
  readonly replyTarget = computed(() => this.reply()?.author ?? null);
  readonly correcting = computed(() => this.reply()?.original != null);

  readonly messages = computed<readonly DiscussionMessage[]>(() => {
    const myId = this.stageStore.currentUserId();
    const hostId = this.stageStore.room()?.hostId ?? '';
    const reactionsMap = this.commentReactions();

    return this.rawComments().map((comment) => {
      const name = this.stageStore.resolveDisplayName(comment.authorId, 'Speaker');
      const tally = reactionsMap.get(comment.id);
      const reactions: MessageReaction[] = [];
      if (tally) {
        for (const [code, count] of Object.entries(tally.counts)) {
          if (isBackendReaction(code) && typeof count === 'number' && count > 0) {
            reactions.push({
              code,
              emoji: emojiForReaction(code),
              count,
              active: tally.mine === code,
              label: labelForReaction(code),
            });
          }
        }
      }

      return {
        id: comment.id,
        authorId: comment.authorId,
        author: name,
        avatarText: (name.trim()[0] ?? 'S').toUpperCase(),
        avatarClass: avatarChipClassFor(comment.authorId),
        isHost: comment.authorId === hostId,
        isYou: comment.authorId === myId,
        isThreadReply: Boolean(comment.replyTo),
        timeLabel: formatTimeLabel(comment.createdAt),
        text:
          comment.type === 'CORRECTION' && comment.correctedContent
            ? `${comment.content} → ${comment.correctedContent}`
            : comment.content,
        reactions,
      };
    });
  });

  readonly pinnedMessage = computed<DiscussionMessage | null>(() => {
    const id = this.pinnedCommentId();
    return id ? (this.messages().find((m) => m.id === id) ?? null) : null;
  });

  readonly commentCountLabel = computed(() => {
    const count = this.messages().length;
    return count === 1 ? '1 message' : `${count} messages`;
  });

  revision(): number {
    return this.chatRevision;
  }

  setChatMuted(muted: boolean): void {
    this.isChatMutedState.set(muted);
  }

  setChatError(hasError: boolean): void {
    this.chatErrorState.set(hasError);
  }

  applyChatState(chatState: ChatStateDto): void {
    this.rawCommentsState.set(chatState.comments);
    this.pinnedTopicState.set(chatState.topic);
    this.pinnedCommentIds.set(
      chatState.comments
        .flatMap(({ id, pinnedAt }) => (pinnedAt ? [{ id, at: Date.parse(pinnedAt) }] : []))
        .sort((a, b) => b.at - a.at)
        .map(({ id }) => id),
    );
    this.isChatMutedState.set(chatState.muted);
    this.chatMutedUsersState.set(new Set(chatState.mutedUsers));
    this.commentReactionsState.set(
      new Map(
        chatState.reactions.map(
          ({ commentId, counts, mine }) => [commentId, { counts, mine: mine ?? null }] as const,
        ),
      ),
    );
    this.chatErrorState.set(false);
    this.stageStore.resolveMissingUsers(chatState.comments.map((c) => c.authorId));
  }

  reloadMessages(onDone?: (ok: boolean) => void): void {
    const id = this.stageStore.roomId();
    if (!id) {
      onDone?.(false);
      return;
    }
    const generation = this.stageStore.generation();
    this.chatErrorState.set(false);
    this.loadingState.set(true);

    const fetchAttempt = (attempt: number): void => {
      const revisionBefore = this.chatRevision;
      this.voiceRoomApi.getChatState(id).subscribe({
        next: (chatState) => {
          if (generation !== this.stageStore.generation()) {
            onDone?.(false);
            return;
          }
          if (revisionBefore === this.chatRevision) {
            this.loadingState.set(false);
            this.applyChatState(chatState);
            onDone?.(true);
            return;
          }
          if (attempt + 1 < 2) {
            fetchAttempt(attempt + 1);
            return;
          }
          this.loadingState.set(false);
          this.chatErrorState.set(true);
          onDone?.(false);
        },
        error: () => {
          if (generation === this.stageStore.generation()) {
            this.loadingState.set(false);
            this.chatErrorState.set(true);
          }
          onDone?.(false);
        },
      });
    };

    fetchAttempt(0);
  }

  sendMessage(content: string, onDone?: (res: ActionFeedback) => void): void {
    const id = this.stageStore.roomId();
    if (!id) {
      onDone?.({ ok: false, message: 'No active room.' });
      return;
    }
    const trimmed = content.trim();
    if (!trimmed) {
      onDone?.({ ok: false, message: 'Write something first.' });
      return;
    }

    const reply = this.reply();
    const generation = this.stageStore.generation();
    const original = reply?.original ?? null;
    this.voiceRoomApi
      .postComment(id, {
        type: original === null ? 'TEXT' : 'CORRECTION',
        content: original ?? trimmed,
        ...(original !== null ? { correctedContent: trimmed } : {}),
        replyTo: reply?.commentId ?? null,
      })
      .subscribe({
        next: (comment) => {
          if (generation === this.stageStore.generation()) {
            this.appendCommentIfNew(comment);
            if (this.reply() === reply) this.setReplyTarget(null);
          }
          onDone?.({ ok: true });
        },
        error: (err: unknown) => {
          onDone?.({ ok: false, message: errorMessage(err, 'Could not send message.') });
        },
      });
  }

  deleteMessage(commentId: string, onDone?: (res: ActionFeedback) => void): void {
    const generation = this.stageStore.generation();
    this.stageStore.runRoomCommand(
      (id) => this.voiceRoomApi.deleteComment(id, commentId),
      'Could not delete message.',
      () => {
        if (generation === this.stageStore.generation()) {
          this.applyChatRealtimeEvent({ type: 'COMMENT_DELETED', commentId });
        }
      },
      onDone,
    );
  }

  toggleReaction(
    commentId: string,
    reaction: BackendReaction,
    onDone?: (res: ActionFeedback) => void,
  ): void {
    this.stageStore.runRoomCommand(
      (id) =>
        this.commentReactions().get(commentId)?.mine === reaction
          ? this.voiceRoomApi.removeCommentReaction(id, commentId)
          : this.voiceRoomApi.reactToComment(id, commentId, reaction),
      'Could not update reaction.',
      undefined,
      onDone,
    );
  }

  pinMessage(commentId: string | null, onDone?: (res: ActionFeedback) => void): void {
    const generation = this.stageStore.generation();
    if (commentId) {
      this.stageStore.runRoomCommand(
        (id) => this.voiceRoomApi.pinComment(id, commentId),
        'Could not update pinned comment.',
        () => {
          if (generation === this.stageStore.generation()) {
            this.chatRevision++;
            this.updatePin(commentId, true);
          }
        },
        onDone,
      );
      return;
    }
    const pinned = this.pinnedCommentId();
    if (!pinned) {
      onDone?.({ ok: true });
      return;
    }
    this.stageStore.runRoomCommand(
      (id) => this.voiceRoomApi.unpinComment(id, pinned),
      'Could not update pinned comment.',
      () => {
        if (generation === this.stageStore.generation()) {
          this.chatRevision++;
          this.updatePin(pinned, false);
        }
      },
      onDone,
    );
  }

  setChatTopic(text: string, onDone?: (res: ActionFeedback) => void): void {
    const topic = text.trim();
    const previousTopic = this.pinnedTopic();
    const generation = this.stageStore.generation();
    this.stageStore.runRoomCommand(
      (id) => (topic ? this.voiceRoomApi.pinTopic(id, topic) : this.voiceRoomApi.clearTopic(id)),
      'Could not update chat topic.',
      () => {
        if (generation === this.stageStore.generation() && previousTopic === this.pinnedTopic()) {
          this.applyChatRealtimeEvent({ type: 'TOPIC_CHANGED', topic: topic || null });
        }
      },
      onDone,
    );
  }

  muteChatUser(targetUserId: string, onDone?: (res: ActionFeedback) => void): void {
    this.stageStore.runRoomCommand(
      (id) =>
        this.chatMutedUsers().has(targetUserId)
          ? this.voiceRoomApi.unmuteChatUser(id, targetUserId)
          : this.voiceRoomApi.muteChatUser(id, targetUserId),
      'Could not update chat mute.',
      undefined,
      onDone,
    );
  }

  setReplyTarget(
    author: string | null,
    commentId: string | null = null,
    original: string | null = null,
  ): void {
    this.reply.set(author ? { author, commentId, original } : null);
  }

  applyChatRealtimeEvent(event: ChatRealtimeEvent): void {
    this.chatRevision++;
    switch (event.type) {
      case 'COMMENT_POSTED':
        if (event.comment) {
          this.appendCommentIfNew(event.comment);
          this.stageStore.resolveMissingUsers([event.comment.authorId]);
        }
        return;
      case 'COMMENT_DELETED': {
        const commentId = event.commentId;
        if (!commentId) return;
        this.rawCommentsState.update((list): readonly RoomCommentDto[] =>
          list.filter((c) => c.id !== commentId),
        );
        this.commentReactionsState.update(
          (prev): ReadonlyMap<string, CommentReactionTallyDto> => {
            if (!prev.has(commentId)) return prev;
            const next = new Map(prev);
            next.delete(commentId);
            return next;
          },
        );
        this.updatePin(commentId, false);
        return;
      }
      case 'COMMENT_REACTED': {
        const commentId = event.commentId;
        const userId = event.targetUserId;
        if (!commentId || !userId) return;
        const reaction = isBackendReaction(event.reaction) ? event.reaction : null;
        const previous = isBackendReaction(event.previous) ? event.previous : null;
        const myId = this.stageStore.currentUserId();
        this.commentReactionsState.update(
          (prev): ReadonlyMap<string, CommentReactionTallyDto> => {
            const next = new Map(prev);
            const existing = next.get(commentId) ?? { counts: {}, mine: null };
            const counts: Partial<Record<BackendReaction, number>> = { ...existing.counts };

            if (previous) {
              const dec = (counts[previous] ?? 1) - 1;
              if (dec > 0) counts[previous] = dec;
              else delete counts[previous];
            }
            if (reaction) {
              counts[reaction] = (counts[reaction] ?? 0) + 1;
            }

            next.set(commentId, {
              counts,
              mine: userId === myId ? reaction : existing.mine,
            });
            return next;
          },
        );
        return;
      }
      case 'COMMENT_PINNED':
        if (event.commentId) this.updatePin(event.commentId, true);
        return;
      case 'COMMENT_UNPINNED':
        if (event.commentId) this.updatePin(event.commentId, false);
        return;
      case 'CHAT_MUTED': {
        const targetUserId = event.targetUserId;
        if (!targetUserId) return;
        this.chatMutedUsersState.update((prev): ReadonlySet<string> => new Set(prev).add(targetUserId));
        if (targetUserId === this.stageStore.currentUserId()) this.isChatMutedState.set(true);
        return;
      }
      case 'CHAT_UNMUTED': {
        const targetUserId = event.targetUserId;
        if (!targetUserId) return;
        this.chatMutedUsersState.update((prev): ReadonlySet<string> => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });
        if (targetUserId === this.stageStore.currentUserId()) this.isChatMutedState.set(false);
        return;
      }
      case 'TOPIC_CHANGED':
        this.pinnedTopicState.set(event.topic ?? null);
    }
  }

  reset(): void {
    this.loadingState.set(false);
    this.chatErrorState.set(false);
    this.setReplyTarget(null);
    this.rawCommentsState.set([]);
    this.commentReactionsState.set(new Map());
    this.pinnedTopicState.set(null);
    this.pinnedCommentIds.set([]);
    this.chatMutedUsersState.set(new Set());
    this.isChatMutedState.set(false);
  }

  private updatePin(id: string, pinned: boolean): void {
    this.pinnedCommentIds.update((ids): readonly string[] => {
      const remaining = ids.filter((existing) => existing !== id);
      return pinned ? [id, ...remaining] : remaining;
    });
  }

  private appendCommentIfNew(comment: RoomCommentDto): void {
    const comments = this.rawCommentsState();
    if (comments.some((existing) => existing.id === comment.id)) return;
    this.chatRevision++;
    this.rawCommentsState.set([...comments, comment]);
  }
}
