import { msg } from '@shared/utils/i18n/msg';
import type { Reaction } from '../models/reaction.model';

export const REACTION_LOOKS: Readonly<Record<Reaction, { icon: string; label: string }>> = {
  HEART: { icon: 'pi pi-heart-fill', label: msg('Heart') },
  THUMBS_UP: { icon: 'pi pi-thumbs-up-fill', label: msg('Thumbs up') },
  SMILE: { icon: 'pi pi-face-smile', label: msg('Smile') },
  SPARKLES: { icon: 'pi pi-sparkles', label: msg('Sparkles') },
};
