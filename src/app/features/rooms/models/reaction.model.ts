export const REACTIONS = ['HEART', 'THUMBS_UP', 'SMILE', 'SPARKLES'] as const;

export type Reaction = (typeof REACTIONS)[number];

export interface ReactionBurst {
  readonly userId: string;
  readonly reaction: Reaction;
}

export interface FloatingReaction extends ReactionBurst {
  readonly id: number;
}

export function isReaction(value: unknown): value is Reaction {
  return REACTIONS.some((reaction) => reaction === value);
}
