import { msg } from '@shared/utils/i18n/msg';
import type { Reaction } from '../models/reaction.model';

export const REACTION_LOOKS: Readonly<Record<Reaction, { image: string; label: string }>> = {
  HEART: { image: 'icons/reactions/heart.svg', label: msg('Heart') },
  CLAP: { image: 'icons/reactions/clap.svg', label: msg('Clap') },
  THUMBS_UP: { image: 'icons/reactions/thumbs-up.svg', label: msg('Thumbs up') },
  SMILE: { image: 'icons/reactions/smile.svg', label: msg('Smile') },
  SPARKLES: { image: 'icons/reactions/sparkles.svg', label: msg('Sparkles') },
  FIRE: { image: 'icons/reactions/fire.svg', label: msg('Fire') },
  PARTY: { image: 'icons/reactions/party.svg', label: msg('Party') },
  LAUGH: { image: 'icons/reactions/laugh.svg', label: msg('Laugh') },
  WOW: { image: 'icons/reactions/wow.svg', label: msg('Wow') },
  THANKS: { image: 'icons/reactions/thanks.svg', label: msg('Thanks') },
};
