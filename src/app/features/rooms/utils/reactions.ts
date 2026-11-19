import type { Reaction } from '../models/reaction.model';

export const REACTION_LOOKS: Readonly<Record<Reaction, { image: string; label: string }>> = {
  HEART: { image: 'icons/reactions/heart.svg', label: 'Heart' },
  CLAP: { image: 'icons/reactions/clap.svg', label: 'Clap' },
  THUMBS_UP: { image: 'icons/reactions/thumbs-up.svg', label: 'Thumbs up' },
  SMILE: { image: 'icons/reactions/smile.svg', label: 'Smile' },
  SPARKLES: { image: 'icons/reactions/sparkles.svg', label: 'Sparkles' },
  FIRE: { image: 'icons/reactions/fire.svg', label: 'Fire' },
  PARTY: { image: 'icons/reactions/party.svg', label: 'Party' },
  LAUGH: { image: 'icons/reactions/laugh.svg', label: 'Laugh' },
  WOW: { image: 'icons/reactions/wow.svg', label: 'Wow' },
  THANKS: { image: 'icons/reactions/thanks.svg', label: 'Thanks' },
};
