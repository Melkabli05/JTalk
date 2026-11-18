import { asRecord, isStringList } from '@shared/utils/as-record';
import { isReaction, type ReactionBurst } from '../../models/reaction.model';
import type { RoomUpdate } from '../../models/realtime.model';
import type { Stage } from '../../models/room.model';

function readStage(raw: unknown): Stage | undefined {
  const stage = asRecord(raw);
  return stage !== undefined &&
    isStringList(stage['speakers']) &&
    isStringList(stage['handRaiseQueue'])
    ? { speakers: stage['speakers'], handRaiseQueue: stage['handRaiseQueue'] }
    : undefined;
}

function readReactions(raw: unknown): ReactionBurst[] {
  return Array.isArray(raw)
    ? raw.flatMap((item: unknown) => {
        const burst = asRecord(item);
        const userId = burst?.['userId'];
        const reaction = burst?.['reaction'];
        return typeof userId === 'string' && isReaction(reaction) ? [{ userId, reaction }] : [];
      })
    : [];
}

export function parseRoomEvent(raw: unknown): RoomUpdate | undefined {
  const event = asRecord(raw);
  const type = event?.['type'];
  switch (type) {
    case 'STAGE_UPDATED':
    case 'HAND_RAISED':
    case 'HAND_LOWERED': {
      const stage = readStage(event?.['stage']);
      const at = Date.parse(String(event?.['timestamp']));
      return stage === undefined || Number.isNaN(at) ? undefined : { type, at, stage };
    }
    case 'SPEAKER_RECONNECTING':
    case 'SPEAKER_RECONNECTED': {
      const userId = event?.['targetUserId'];
      return typeof userId === 'string' ? { type, userId } : undefined;
    }
    case 'PRESENCE_CHANGED': {
      const presence = asRecord(event?.['presence']);
      return typeof presence?.['participantCount'] === 'number' &&
        isStringList(presence['joined']) &&
        isStringList(presence['left'])
        ? {
            type,
            participantCount: presence['participantCount'],
            joined: presence['joined'],
            left: presence['left'],
          }
        : undefined;
    }
    case 'ROOM_UPDATED': {
      const settings = asRecord(event?.['settings']);
      const topic = settings?.['topic'] ?? '';
      return typeof settings?.['title'] === 'string' &&
        typeof topic === 'string' &&
        typeof settings['maxStageSeats'] === 'number'
        ? { type, title: settings['title'], topic, maxStageSeats: settings['maxStageSeats'] }
        : undefined;
    }
    case 'REACTIONS': {
      const reactions = readReactions(event?.['reactions']);
      return reactions.length > 0 ? { type, reactions } : undefined;
    }
    default:
      return undefined;
  }
}
