import { AVATAR_CHIP_CLASSES, AvatarChipClass } from '../constants/avatar-chips.constants';

export function avatarChipClassFor(id: string): AvatarChipClass {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return AVATAR_CHIP_CLASSES[Math.abs(hash) % AVATAR_CHIP_CLASSES.length]!;
}
