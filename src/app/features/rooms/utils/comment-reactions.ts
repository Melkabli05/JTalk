import type { CommentTally } from '../models/chat.model';
import type { Reaction } from '../models/reaction.model';

/**
 * A comment's tally after one person changes their reaction from `previous` to `next` (either can be none). It is the viewer's own
 * choice, and so becomes `mine`, only when `own` says so. Gone altogether (undefined) once nobody has reacted.
 */
export function withReaction(
  tally: CommentTally | undefined,
  previous: Reaction | null,
  next: Reaction | null,
  own: boolean,
): CommentTally | undefined {
  const counts: Partial<Record<Reaction, number>> = { ...tally?.counts };
  if (previous !== null) {
    counts[previous] = Math.max(0, (counts[previous] ?? 0) - 1);
  }
  if (next !== null) {
    counts[next] = (counts[next] ?? 0) + 1;
  }
  const kept = Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 0));
  const mine = own ? next : (tally?.mine ?? null);
  return Object.keys(kept).length === 0 ? undefined : { counts: kept, mine };
}
