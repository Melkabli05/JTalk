import { computed, effect, inject, Service, signal, untracked } from '@angular/core';
import { errorMessage } from '../../../core/http/http-error.interceptor';
import {
  BackendReaction,
  ChatRealtimeEvent,
  ChatStateDto,
  CommentReactionTallyDto,
  emojiForReaction,
  labelForReaction,
  RoomCommentDto,
} from '../../../shared/models/voice-room.model';
import { avatarChipClassFor } from '../../../shared/utils/avatar-chip.utils';
import { RoomResourceTrigger, VoiceRoomApi } from '../data-access/voice-room-api';
import { DiscussionMessage, MessageReaction } from '../models/live-room.model';
import { ActionFeedback, RoomStageStore } from './room-stage-store';

interface ChatLoadRequest extends RoomResourceTrigger {
  readonly generation: number;
  readonly revisionBefore: number;
  readonly attempt: number;
  readonly onDone?: (ok: boolean) => void;
}

function formatTimeLabel(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

@Service()
export class RoomChatStore {
  private readonly voiceRoomApi = inject(VoiceRoomApi);
  private readonly stageStore = inject(RoomStageStore);

  private chatRevision = 0;
  private chatSeq = 0;

  private readonly chatRequest = signal<ChatLoadRequest | null>(null);
  private readonly chatRes = this.voiceRoomApi.chatStateResource(
    () => this.chatRequest() ?? undefined,
  );

  readonly loading = this.chatRes.isLoading;
  readonly rawComments = signal<readonly RoomCommentDto[]>([]);
  readonly commentReactions = signal<ReadonlyMap<string, CommentReactionTallyDto>>(new Map());
  readonly pinnedTopic = signal<string | null>(null);
  private readonly pinnedCommentIds = signal<readonly string[]>([]);
  readonly pinnedCommentId = computed(() => this.pinnedCommentIds()[0] ?? null);
  readonly chatMutedUsers = signal<ReadonlySet<string>>(new Set());
  readonly isChatMuted = signal(false);
  readonly chatError = signal(false);

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
      const reactions: MessageReaction[] = tally
        ? (Object.entries(tally.counts) as [BackendReaction, number][])
            .filter(([, count]) => count > 0)
            .map(([code, count]) => ({
              code,
              emoji: emojiForReaction(code),
              count,
              active: tally.mine === code,
              label: labelForReaction(code),
            }))
        : [];

      const text =
        comment.type === 'CORRECTION' && comment.correctedContent
          ? `${comment.content} → ${comment.correctedContent}`
          : comment.content;

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
        text,
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

  constructor() {
    effect(() => {
      const req = this.chatRequest();
      if (!req) return;
      const status = this.chatRes.status();
      if (status === 'resolved' && this.chatRes.hasValue()) {
        const chatState = this.chatRes.value();
        untracked(() => {
          if (req.generation !== this.stageStore.generation()) {
            this.chatRequest.set(null);
            req.onDone?.(false);
            return;
          }
          if (req.revisionBefore !== this.chatRevision) {
            if (req.attempt === 0) {
              this.chatRequest.set({
                ...req,
                seq: ++this.chatSeq,
                revisionBefore: this.chatRevision,
                attempt: 1,
              });
            } else {
              this.chatError.set(true);
              this.chatRequest.set(null);
              req.onDone?.(false);
            }
            return;
          }
          this.applyChatState(chatState);
          this.chatRequest.set(null);
          req.onDone?.(true);
        });
      } else if (status === 'error') {
        untracked(() => {
          if (req.generation === this.stageStore.generation()) {
            this.chatError.set(true);
          }
          this.chatRequest.set(null);
          req.onDone?.(false);
        });
      }
    });
  }

  revision(): number {
    return this.chatRevision;
  }

  applyChatState(chatState: ChatStateDto): void {
    this.rawComments.set(chatState.comments);
    this.pinnedTopic.set(chatState.topic);
    this.pinnedCommentIds.set(
      chatState.comments
        .flatMap(({ id, pinnedAt }) => (pinnedAt ? [{ id, at: Date.parse(pinnedAt) }] : []))
        .sort((a, b) => b.at - a.at)
        .map(({ id }) => id),
    );
    this.isChatMuted.set(chatState.muted);
    this.chatMutedUsers.set(new Set(chatState.mutedUsers));
    this.commentReactions.set(
      new Map(
        chatState.reactions.map(
          ({ commentId, counts, mine }) => [commentId, { counts, mine: mine ?? null }] as const,
        ),
      ),
    );
    this.chatError.set(false);
    this.stageStore.resolveMissingUsers(chatState.comments.map((c) => c.authorId));
  }

  reloadMessages(onDone?: (ok: boolean) => void): void {
    const id = this.stageStore.roomId();
    if (!id) {
      onDone?.(false);
      return;
    }
    this.chatError.set(false);
    this.chatRequest.set({
      roomId: id,
      seq: ++this.chatSeq,
      generation: this.stageStore.generation(),
      revisionBefore: this.chatRevision,
      attempt: 0,
      onDone,
    });
  }

  async sendMessage(content: string): Promise<ActionFeedback> {
    const id = this.stageStore.roomId();
    if (!id) return { ok: false, message: 'No active room.' };
    const trimmed = content.trim();
    if (!trimmed) return { ok: false, message: 'Write something first.' };

    const reply = this.reply();
    const generation = this.stageStore.generation();
    const original = reply?.original ?? null;
    try {
      const comment = await this.voiceRoomApi.postComment(id, {
        type: original === null ? 'TEXT' : 'CORRECTION',
        content: original ?? trimmed,
        ...(original !== null ? { correctedContent: trimmed } : {}),
        replyTo: reply?.commentId ?? null,
      });
      if (generation === this.stageStore.generation()) {
        this.appendCommentIfNew(comment);
        if (this.reply() === reply) this.setReplyTarget(null);
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, message: errorMessage(err, 'Could not send message.') };
    }
  }

  deleteMessage(commentId: string): Promise<ActionFeedback> {
    const generation = this.stageStore.generation();
    return this.stageStore.runRoomCommand(
      (id) => this.voiceRoomApi.deleteComment(id, commentId),
      'Could not delete message.',
      () => {
        if (generation === this.stageStore.generation()) {
          this.applyChatRealtimeEvent({ type: 'COMMENT_DELETED', commentId });
        }
      },
    );
  }

  toggleReaction(commentId: string, reaction: BackendReaction): Promise<ActionFeedback> {
    return this.stageStore.runRoomCommand(
      (id) =>
        this.commentReactions().get(commentId)?.mine === reaction
          ? this.voiceRoomApi.removeCommentReaction(id, commentId)
          : this.voiceRoomApi.reactToComment(id, commentId, reaction),
      'Could not update reaction.',
    );
  }

  async pinMessage(commentId: string | null): Promise<ActionFeedback> {
    const generation = this.stageStore.generation();
    if (commentId) {
      return this.stageStore.runRoomCommand(
        (id) => this.voiceRoomApi.pinComment(id, commentId),
        'Could not update pinned comment.',
        () => {
          if (generation === this.stageStore.generation()) {
            this.chatRevision++;
            this.updatePin(commentId, true);
          }
        },
      );
    }
    const pinned = this.pinnedCommentId();
    if (!pinned) return { ok: true };
    return this.stageStore.runRoomCommand(
      (id) => this.voiceRoomApi.unpinComment(id, pinned),
      'Could not update pinned comment.',
      () => {
        if (generation === this.stageStore.generation()) {
          this.chatRevision++;
          this.updatePin(pinned, false);
        }
      },
    );
  }

  setChatTopic(text: string): Promise<ActionFeedback> {
    const topic = text.trim();
    const previousTopic = this.pinnedTopic();
    const generation = this.stageStore.generation();
    return this.stageStore.runRoomCommand(
      (id) => (topic ? this.voiceRoomApi.pinTopic(id, topic) : this.voiceRoomApi.clearTopic(id)),
      'Could not update chat topic.',
      () => {
        if (generation === this.stageStore.generation() && previousTopic === this.pinnedTopic()) {
          this.applyChatRealtimeEvent({ type: 'TOPIC_CHANGED', topic: topic || null });
        }
      },
    );
  }

  muteChatUser(targetUserId: string): Promise<ActionFeedback> {
    return this.stageStore.runRoomCommand(
      (id) =>
        this.chatMutedUsers().has(targetUserId)
          ? this.voiceRoomApi.unmuteChatUser(id, targetUserId)
          : this.voiceRoomApi.muteChatUser(id, targetUserId),
      'Could not update chat mute.',
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
        this.appendCommentIfNew(event.comment);
        this.stageStore.resolveMissingUsers([event.comment.authorId]);
        return;
      case 'COMMENT_DELETED':
        this.rawComments.update((list) => list.filter((c) => c.id !== event.commentId));
        this.commentReactions.update((prev) => {
          if (!prev.has(event.commentId)) return prev;
          const next = new Map(prev);
          next.delete(event.commentId);
          return next;
        });
        this.updatePin(event.commentId, false);
        return;
      case 'COMMENT_REACTED': {
        const myId = this.stageStore.currentUserId();
        this.commentReactions.update((prev) => {
          const next = new Map(prev);
          const existing = next.get(event.commentId) ?? { counts: {}, mine: null };
          const counts: Partial<Record<BackendReaction, number>> = { ...existing.counts };

          if (event.previous) {
            const dec = (counts[event.previous] ?? 1) - 1;
            if (dec > 0) counts[event.previous] = dec;
            else delete counts[event.previous];
          }
          if (event.reaction) {
            counts[event.reaction] = (counts[event.reaction] ?? 0) + 1;
          }

          next.set(event.commentId, {
            counts,
            mine: event.userId === myId ? event.reaction : existing.mine,
          });
          return next;
        });
        return;
      }
      case 'COMMENT_PINNED':
        this.updatePin(event.commentId, true);
        return;
      case 'COMMENT_UNPINNED':
        if (event.commentId) this.updatePin(event.commentId, false);
        return;
      case 'CHAT_MUTED':
        this.chatMutedUsers.update((prev) => new Set(prev).add(event.userId));
        if (event.userId === this.stageStore.currentUserId()) this.isChatMuted.set(true);
        return;
      case 'CHAT_UNMUTED':
        this.chatMutedUsers.update((prev) => {
          const next = new Set(prev);
          next.delete(event.userId);
          return next;
        });
        if (event.userId === this.stageStore.currentUserId()) this.isChatMuted.set(false);
        return;
      case 'TOPIC_CHANGED':
        this.pinnedTopic.set(event.topic);
    }
  }

  reset(): void {
    this.chatRequest.set(null);
    this.chatError.set(false);
    this.setReplyTarget(null);
    this.rawComments.set([]);
    this.commentReactions.set(new Map());
    this.pinnedTopic.set(null);
    this.pinnedCommentIds.set([]);
    this.chatMutedUsers.set(new Set());
    this.isChatMuted.set(false);
  }

  private updatePin(id: string, pinned: boolean): void {
    this.pinnedCommentIds.update((ids) => {
      const remaining = ids.filter((existing) => existing !== id);
      return pinned ? [id, ...remaining] : remaining;
    });
  }

  private appendCommentIfNew(comment: RoomCommentDto): void {
    const comments = this.rawComments();
    if (comments.some((existing) => existing.id === comment.id)) return;
    this.chatRevision++;
    this.rawComments.set([...comments, comment]);
  }
}
