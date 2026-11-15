import { asRecord, isStringList } from '@shared/utils/as-record';
import type { Stage } from '../../models/room.model';

export function parseStage(raw: unknown): Stage {
  const stage = asRecord(raw);
  if (
    stage === undefined ||
    !isStringList(stage['speakers']) ||
    !isStringList(stage['handRaiseQueue'])
  ) {
    throw new Error('Unexpected response: expected a stage');
  }
  return { speakers: stage['speakers'], handRaiseQueue: stage['handRaiseQueue'] };
}
