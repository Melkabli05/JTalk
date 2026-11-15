import { asRecord } from '@shared/utils/as-record';
import type { Participant } from '../../models/room.model';

function parseParticipant(raw: unknown): Participant {
  const participant = asRecord(raw);
  if (
    participant === undefined ||
    typeof participant['userId'] !== 'string' ||
    (participant['status'] !== 'ACTIVE' && participant['status'] !== 'RECONNECTING')
  ) {
    throw new Error('Unexpected response: expected a participant');
  }
  return {
    userId: participant['userId'],
    reconnecting: participant['status'] === 'RECONNECTING',
  };
}

export function parseParticipants(raw: unknown): Participant[] {
  if (!Array.isArray(raw)) {
    throw new Error('Unexpected response: expected a list of participants');
  }
  return raw.map((item) => parseParticipant(item));
}
