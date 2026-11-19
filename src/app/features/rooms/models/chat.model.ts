import type { Reaction } from './reaction.model';

export type CommentType = 'TEXT' | 'CORRECTION';

export interface RoomComment {
  readonly id: string;
  readonly authorId: string;
  readonly type: CommentType;
  readonly content: string;
  readonly correctedContent?: string;
  readonly replyTo?: string;
  readonly createdAt: string;
}

/** What the room reacted to one comment with: how many people chose each reaction, and which one is the viewer's own. */
export interface CommentTally {
  readonly counts: Readonly<Partial<Record<Reaction, number>>>;
  readonly mine: Reaction | null;
}

export interface ChatState {
  readonly comments: readonly RoomComment[];
  readonly topic: string | null;
  readonly muted: boolean;
  readonly mutedUsers: readonly string[];
  readonly reactions: ReadonlyMap<string, CommentTally>;
}

export interface CommentDraft {
  readonly type: CommentType;
  readonly content: string;
  readonly correctedContent?: string;
  readonly replyTo?: string;
}

export type ChatUpdate =
  | { readonly type: 'COMMENT_POSTED'; readonly comment: RoomComment }
  | { readonly type: 'COMMENT_DELETED'; readonly commentId: string }
  | {
      readonly type: 'COMMENT_REACTED';
      readonly commentId: string;
      readonly userId: string;
      readonly reaction: Reaction | null;
      readonly previous: Reaction | null;
    }
  | { readonly type: 'CHAT_MUTED' | 'CHAT_UNMUTED'; readonly userId: string }
  | { readonly type: 'TOPIC_CHANGED'; readonly topic: string | null };

export const COMMENTS_KEPT = 50;
export const COMMENT_MAX_LENGTH = 500;
export const TOPIC_MAX_LENGTH = 200;
