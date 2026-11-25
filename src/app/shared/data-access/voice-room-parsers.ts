import { asRecord, isStringList } from '../../core/http/as-record';
import {
  BackendReaction,
  ChatRealtimeEvent,
  isBackendReaction,
  ReactionBurstDto,
  RoomCommentDto,
  RoomRealtimeEvent,
} from '../models/voice-room.model';

function readComment(raw: unknown): RoomCommentDto | undefined {
  const rec = asRecord(raw);
  if (
    !rec ||
    typeof rec['id'] !== 'string' ||
    typeof rec['authorId'] !== 'string' ||
    (rec['type'] !== 'TEXT' && rec['type'] !== 'CORRECTION') ||
    typeof rec['content'] !== 'string' ||
    typeof rec['createdAt'] !== 'string'
  ) {
    return undefined;
  }
  return {
    id: rec['id'],
    authorId: rec['authorId'],
    type: rec['type'],
    content: rec['content'],
    createdAt: rec['createdAt'],
    ...(typeof rec['pinnedAt'] === 'string' ? { pinnedAt: rec['pinnedAt'] } : {}),
    ...(typeof rec['correctedContent'] === 'string'
      ? { correctedContent: rec['correctedContent'] }
      : {}),
    ...(typeof rec['replyTo'] === 'string' ? { replyTo: rec['replyTo'] } : {}),
  };
}

function readReactionOrNull(raw: unknown): BackendReaction | null {
  return isBackendReaction(raw) ? raw : null;
}

export function parseRoomRealtimeEvent(raw: unknown): RoomRealtimeEvent | undefined {
  const rec = asRecord(raw);
  const type = rec?.['type'];
  switch (type) {
    case 'STAGE_UPDATED':
    case 'HAND_RAISED':
    case 'HAND_LOWERED': {
      const stageRec = asRecord(rec?.['stage']);
      const at = Date.parse(String(rec?.['timestamp']));
      if (
        Number.isFinite(at) &&
        stageRec &&
        isStringList(stageRec['speakers']) &&
        isStringList(stageRec['handRaiseQueue'])
      ) {
        return {
          type,
          at,
          stage: {
            speakers: stageRec['speakers'],
            handRaiseQueue: stageRec['handRaiseQueue'],
          },
        };
      }
      return undefined;
    }
    case 'SPEAKER_RECONNECTING':
    case 'SPEAKER_RECONNECTED':
      return typeof rec?.['targetUserId'] === 'string'
        ? { type, userId: rec['targetUserId'] }
        : undefined;
    case 'PRESENCE_CHANGED': {
      const presence = asRecord(rec?.['presence']);
      if (
        presence &&
        typeof presence['participantCount'] === 'number' &&
        isStringList(presence['joined']) &&
        isStringList(presence['left'])
      ) {
        return {
          type,
          participantCount: presence['participantCount'],
          ...(typeof presence['audienceCount'] === 'number' ? { audienceCount: presence['audienceCount'] } : {}),
          joined: presence['joined'],
          left: presence['left'],
        };
      }
      return undefined;
    }
    case 'ROOM_UPDATED': {
      const settings = asRecord(rec?.['settings']);
      const topic = settings?.['topic'] ?? '';
      if (
        settings &&
        typeof settings['title'] === 'string' &&
        typeof topic === 'string' &&
        typeof settings['maxStageSeats'] === 'number'
      ) {
        return {
          type,
          title: settings['title'],
          topic,
          maxStageSeats: settings['maxStageSeats'],
          ...(typeof settings['hostId'] === 'string' ? { hostId: settings['hostId'] } : {}),
        };
      }
      return undefined;
    }
    case 'REACTIONS': {
      const rawReactions = Array.isArray(rec?.['reactions']) ? rec['reactions'] : [];
      const reactions: ReactionBurstDto[] = [];
      for (const item of rawReactions) {
        const entry = asRecord(item);
        if (typeof entry?.['userId'] === 'string' && isBackendReaction(entry['reaction'])) {
          reactions.push({ userId: entry['userId'], reaction: entry['reaction'] });
        }
      }
      return reactions.length > 0 ? { type, reactions } : undefined;
    }
    case 'PARTICIPANT_PROFILE_UPDATED': {
      const update = asRecord(rec?.['profileUpdate']);
      if (typeof update?.['userId'] === 'string' && typeof update?.['avatarUrl'] === 'string') {
        return {
          type,
          userId: update['userId'],
          avatarUrl: update['avatarUrl'],
        };
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

export function parseChatRealtimeEvent(raw: unknown): ChatRealtimeEvent | undefined {
  const rec = asRecord(raw);
  switch (rec?.['type']) {
    case 'COMMENT_POSTED': {
      const comment = readComment(rec['comment']);
      return comment ? { type: 'COMMENT_POSTED', comment } : undefined;
    }
    case 'COMMENT_DELETED':
      return typeof rec['commentId'] === 'string'
        ? { type: 'COMMENT_DELETED', commentId: rec['commentId'] }
        : undefined;
    case 'COMMENT_REACTED':
      return typeof rec['commentId'] === 'string' && typeof rec['targetUserId'] === 'string'
        ? {
            type: 'COMMENT_REACTED',
            commentId: rec['commentId'],
            userId: rec['targetUserId'],
            reaction: readReactionOrNull(rec['reaction']),
            previous: readReactionOrNull(rec['previous']),
          }
        : undefined;
    case 'COMMENT_PINNED':
      return typeof rec['commentId'] === 'string'
        ? { type: 'COMMENT_PINNED', commentId: rec['commentId'] }
        : undefined;
    case 'COMMENT_UNPINNED':
      return {
        type: 'COMMENT_UNPINNED',
        commentId: typeof rec['commentId'] === 'string' ? rec['commentId'] : null,
      };
    case 'CHAT_MUTED':
    case 'CHAT_UNMUTED':
      return typeof rec['targetUserId'] === 'string'
        ? { type: rec['type'], userId: rec['targetUserId'] }
        : undefined;
    case 'TOPIC_CHANGED': {
      const topic = rec['topic'] ?? null;
      return typeof topic === 'string' || topic === null
        ? { type: 'TOPIC_CHANGED', topic }
        : undefined;
    }
    default:
      return undefined;
  }
}
