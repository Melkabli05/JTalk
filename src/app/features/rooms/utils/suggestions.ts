import type { Room } from '../models/room.model';

/** One thing worth doing now, worked out from the rooms that are open and from what the person speaks and learns. */
export type Suggestion =
  | { readonly kind: 'match' | 'seats' | 'busiest'; readonly room: Room }
  | { readonly kind: 'start'; readonly language: string };

/** What the person speaks and what they are learning. */
export interface Learner {
  readonly nativeLanguage: string;
  readonly learning: string;
}

const openSeats = (room: Room): number => Math.max(0, room.maxStageSeats - room.speakers.length);

/** The room that comes first by `score`, higher first; the earlier one in the list wins a tie (the list is newest first). */
function best(rooms: readonly Room[], score: (room: Room) => number): Room | undefined {
  return rooms.reduce<Room | undefined>(
    (top, room) => (top === undefined || score(room) > score(top) ? room : top),
    undefined,
  );
}

/**
 * Up to `limit` suggestions, most useful first, never the same room twice:
 * - `match`: a room practising what you learn, for people who speak what you speak (the best match, with seats free first);
 * - `seats`: another room practising what you learn that has stage seats free, to speak and not only to listen;
 * - `busiest`: the room with the most people in it;
 * - `start`: when nobody is practising what you learn, be the first.
 * Nothing here is made up: each one is a room that exists in the list, or the plain fact that there is none.
 */
export function suggest(
  rooms: readonly Room[],
  me: Learner | null,
  limit = 3,
): readonly Suggestion[] {
  const used = new Set<string>();
  const found: Suggestion[] = [];
  const take = (kind: 'match' | 'seats' | 'busiest', room: Room | undefined): void => {
    if (room !== undefined) {
      used.add(room.id);
      found.push({ kind, room });
    }
  };
  const free = (candidates: readonly Room[]) => candidates.filter((room) => !used.has(room.id));

  const learning =
    me && me.learning !== '' ? rooms.filter((r) => r.targetLanguage === me.learning) : [];
  if (me) {
    take(
      'match',
      best(
        learning.filter((room) => room.nativeLanguage === me.nativeLanguage),
        (room) => openSeats(room) * 1000 + room.participantCount,
      ),
    );
    take(
      'seats',
      best(
        free(learning).filter((room) => openSeats(room) > 0),
        openSeats,
      ),
    );
  }
  take(
    'busiest',
    best(free(rooms), (room) => room.participantCount),
  );
  if (me && me.learning !== '' && learning.length === 0) {
    found.push({ kind: 'start', language: me.learning });
  }
  return found.slice(0, limit);
}
