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

export interface ChatState {
  readonly comments: readonly RoomComment[];
  readonly topic: string | null;
  readonly muted: boolean;
  readonly mutedUsers: readonly string[];
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
  | { readonly type: 'CHAT_MUTED' | 'CHAT_UNMUTED'; readonly userId: string }
  | { readonly type: 'TOPIC_CHANGED'; readonly topic: string | null };

export const COMMENTS_KEPT = 50;
export const COMMENT_MAX_LENGTH = 500;
export const TOPIC_MAX_LENGTH = 200;
