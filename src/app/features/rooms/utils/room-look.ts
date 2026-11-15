import { type Language, languageOf } from '@shared/utils/languages';
import type { Room } from '../models/room.model';
import { blockColors } from './members';

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
