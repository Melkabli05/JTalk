import { type Language, languageOf } from '@shared/utils/languages';
import type { Room } from '../models/room.model';
import { blockColors } from './members';

/** How a room looks wherever it is shown: the language practised, the one it is explained in, and its block of color. */
export function roomLook(room: Pick<Room, 'targetLanguage' | 'nativeLanguage'> | undefined): {
  target: Language;
  native: Language;
  colors: { background: string; color: string };
} {
  const target = room?.targetLanguage ?? '';
  return {
    target: languageOf(target),
    native: languageOf(room?.nativeLanguage ?? ''),
    colors: blockColors(target),
  };
}
