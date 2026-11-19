import { asRecord, isStringList } from '@shared/utils/as-record';
import type { ChatState, ChatUpdate, CommentTally, RoomComment } from '../../models/chat.model';
import { isReaction, REACTIONS, type Reaction } from '../../models/reaction.model';

function readComment(raw: unknown): RoomComment | undefined {
  const comment = asRecord(raw);
  if (
    comment === undefined ||
    typeof comment['id'] !== 'string' ||
    typeof comment['authorId'] !== 'string' ||
    (comment['type'] !== 'TEXT' && comment['type'] !== 'CORRECTION') ||
    typeof comment['content'] !== 'string' ||
    typeof comment['createdAt'] !== 'string'
  ) {
    return undefined;
  }
  const corrected = comment['correctedContent'];
  const replyTo = comment['replyTo'];
  return {
    id: comment['id'],
    authorId: comment['authorId'],
    type: comment['type'],
    content: comment['content'],
    createdAt: comment['createdAt'],
    ...(typeof corrected === 'string' ? { correctedContent: corrected } : {}),
    ...(typeof replyTo === 'string' ? { replyTo } : {}),
  };
}

function readReaction(raw: unknown): Reaction | null {
  return isReaction(raw) ? raw : null;
}

function readReactions(raw: unknown): Map<string, CommentTally> {
  const tallies = new Map<string, CommentTally>();
  for (const item of Array.isArray(raw) ? (raw as unknown[]) : []) {
    const entry = asRecord(item);
    const counts = asRecord(entry?.['counts']);
    if (typeof entry?.['commentId'] === 'string' && counts !== undefined) {
      tallies.set(entry['commentId'], {
        counts: Object.fromEntries(
          REACTIONS.flatMap((reaction) => {
            const count = counts[reaction];
            return typeof count === 'number' && count > 0 ? [[reaction, count]] : [];
          }),
        ),
        mine: readReaction(entry['mine']),
      });
    }
  }
  return tallies;
}

export function parseComment(raw: unknown): RoomComment {
  const comment = readComment(raw);
  if (comment === undefined) {
    throw new Error('Unexpected response: expected a comment');
  }
  return comment;
}

export function parseChatState(raw: unknown): ChatState {
  const state = asRecord(raw);
  const topic = state?.['topic'] ?? null;
  if (
    state === undefined ||
    !Array.isArray(state['comments']) ||
    (typeof topic !== 'string' && topic !== null) ||
    typeof state['muted'] !== 'boolean' ||
    !isStringList(state['mutedUsers'])
  ) {
    throw new Error('Unexpected response: expected a chat');
  }
  return {
    comments: state['comments'].map((item) => parseComment(item)),
    topic,
    muted: state['muted'],
    mutedUsers: state['mutedUsers'],
    reactions: readReactions(state['reactions']),
  };
}

export function parseChatEvent(raw: unknown): ChatUpdate | undefined {
  const event = asRecord(raw);
  switch (event?.['type']) {
    case 'COMMENT_POSTED': {
      const comment = readComment(event['comment']);
      return comment === undefined ? undefined : { type: 'COMMENT_POSTED', comment };
    }
    case 'COMMENT_DELETED':
      return typeof event['commentId'] === 'string'
        ? { type: 'COMMENT_DELETED', commentId: event['commentId'] }
        : undefined;
    case 'COMMENT_REACTED':
      return typeof event['commentId'] === 'string' && typeof event['targetUserId'] === 'string'
        ? {
            type: 'COMMENT_REACTED',
            commentId: event['commentId'],
            userId: event['targetUserId'],
            reaction: readReaction(event['reaction']),
            previous: readReaction(event['previous']),
          }
        : undefined;
    case 'CHAT_MUTED':
    case 'CHAT_UNMUTED':
      return typeof event['targetUserId'] === 'string'
        ? { type: event['type'], userId: event['targetUserId'] }
        : undefined;
    case 'TOPIC_CHANGED': {
      const topic = event['topic'] ?? null;
      return typeof topic === 'string' || topic === null
        ? { type: 'TOPIC_CHANGED', topic }
        : undefined;
    }
    default:
      return undefined;
  }
}
