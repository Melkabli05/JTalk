import { asRecord } from '@shared/utils/as-record';
import type { Participant, Stage } from '../../models/room.model';
import { isRole, isStringList } from './rooms.adapter';

/** `parse` for an `httpResource`: who is on the stage and who has a hand up, in order. */
export function parseStage(raw: unknown): Stage {
  const dto = asRecord(raw);
  if (dto === undefined || !isStringList(dto['speakers']) || !isStringList(dto['handRaiseQueue'])) {
    throw new Error('Unexpected response: expected a stage');
  }
  return { speakers: dto['speakers'], handRaiseQueue: dto['handRaiseQueue'] };
}

function parseParticipant(raw: unknown): Participant {
  const dto = asRecord(raw);
  if (
    dto === undefined ||
    typeof dto['userId'] !== 'string' ||
    !isRole(dto['role']) ||
    (dto['status'] !== 'ACTIVE' && dto['status'] !== 'RECONNECTING')
  ) {
    throw new Error('Unexpected response: expected a participant');
  }
  return {
    userId: dto['userId'],
    role: dto['role'],
    reconnecting: dto['status'] === 'RECONNECTING',
  };
}

/** `parse` for an `httpResource`: the people currently in the room. */
export function parseParticipants(raw: unknown): Participant[] {
  if (!Array.isArray(raw)) {
    throw new Error('Unexpected response: expected a list of participants');
  }
  return raw.map((item) => parseParticipant(item));
}
