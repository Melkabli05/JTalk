import type { MuteReason } from '../models/live-room.model';

export interface ModerateTargetCheck {
  readonly isHost: boolean;
  readonly isModerator: boolean;
  readonly currentUserId: string;
  readonly hostId: string | null | undefined;
  readonly moderatorIds: ReadonlySet<string>;
  readonly targetUserId: string;
}

export interface SpeakerMuteDerivationInput {
  readonly userId: string;
  readonly isYou: boolean;
  readonly localMicOn: boolean;
  readonly localMutedByHost: boolean;
  readonly hostMutedIds: ReadonlySet<string>;
  readonly remoteMutedIds: ReadonlySet<string>;
}

export interface SpeakerMuteDerivation {
  readonly muted: boolean;
  readonly muteReason?: MuteReason;
}

/**
 * Removes users who left the room or are already seated on stage from the hand-raise queue,
 * preserving FIFO order and deduplicating entries.
 */
export function pruneHandRaiseQueue(
  queue: readonly string[],
  departedIds: ReadonlySet<string>,
  speakerIds: ReadonlySet<string>,
): readonly string[] {
  if (queue.length === 0) return queue;
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of queue) {
    if (!id || seen.has(id) || departedIds.has(id) || speakerIds.has(id)) {
      continue;
    }
    seen.add(id);
    next.push(id);
  }
  return next.length === queue.length && next.every((id, index) => id === queue[index])
    ? queue
    : next;
}

/**
 * Mirrors backend RoomAccessValidatorImpl.requireCanModerateTarget:
 * - Requires requester to be host or moderator
 * - Cannot moderate self
 * - Cannot moderate the room host
 * - Moderators cannot moderate other moderators
 */
export function canModerateTargetUser(input: ModerateTargetCheck): boolean {
  const { isHost, isModerator, currentUserId, hostId, moderatorIds, targetUserId } = input;
  if (!targetUserId || (!isHost && !isModerator)) return false;
  if (targetUserId === currentUserId) return false;
  if (hostId && targetUserId === hostId) return false;
  if (!isHost && moderatorIds.has(targetUserId)) return false;
  return true;
}

/**
 * Derives whether a seated speaker is muted and whether the mute was enforced by the host/moderator
 * or self-toggled by the speaker.
 */
export function deriveSpeakerMuteState(input: SpeakerMuteDerivationInput): SpeakerMuteDerivation {
  const { userId, isYou, localMicOn, localMutedByHost, hostMutedIds, remoteMutedIds } = input;
  if (isYou) {
    if (localMutedByHost || hostMutedIds.has(userId)) {
      return { muted: true, muteReason: 'host' };
    }
    if (!localMicOn) {
      return { muted: true, muteReason: 'self' };
    }
    return { muted: false };
  }

  if (hostMutedIds.has(userId)) {
    return { muted: true, muteReason: 'host' };
  }
  if (remoteMutedIds.has(userId)) {
    return { muted: true, muteReason: 'self' };
  }
  return { muted: false };
}

/**
 * Orders audience listener IDs so listeners with a raised hand appear first in FIFO queue order,
 * followed by remaining listeners in their existing order.
 */
export function orderListenersByRaisedHand(
  audienceIds: readonly string[],
  handRaiseQueue: readonly string[],
  speakerIds: ReadonlySet<string>,
): readonly string[] {
  const raisedOrder = new Map<string, number>();
  handRaiseQueue.forEach((id, index) => {
    if (!raisedOrder.has(id)) raisedOrder.set(id, index);
  });

  const visible = audienceIds.filter((id) => !speakerIds.has(id));
  if (raisedOrder.size === 0) return visible;

  const raised: string[] = [];
  const rest: string[] = [];
  for (const id of visible) {
    if (raisedOrder.has(id)) {
      raised.push(id);
    } else {
      rest.push(id);
    }
  }
  raised.sort((a, b) => (raisedOrder.get(a) ?? 0) - (raisedOrder.get(b) ?? 0));
  return [...raised, ...rest];
}
