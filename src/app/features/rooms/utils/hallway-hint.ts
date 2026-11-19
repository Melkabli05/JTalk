import type { Room } from '../models/room.model';

/** What the banner says about the rooms, in terms of the language the person is learning. */
export type Hint =
  | { readonly kind: 'practising'; readonly language: string; readonly count: number }
  | { readonly kind: 'first'; readonly language: string }
  | { readonly kind: 'plain' };

/** What the person is learning. */
export interface Learner {
  readonly learning: string;
}

/**
 * How many open rooms are practising what the person learns, or, when there are none, that they could be the first. With no language
 * to go by (the person is not known yet, or has none) there is nothing to say but the plain line. Only facts about the list: nothing here
 * is made up.
 */
export function hintFor(rooms: readonly Room[], me: Learner | null): Hint {
  const language = me?.learning ?? '';
  if (language === '') {
    return { kind: 'plain' };
  }
  const count = rooms.filter((room) => room.targetLanguage === language).length;
  return count > 0 ? { kind: 'practising', language, count } : { kind: 'first', language };
}
