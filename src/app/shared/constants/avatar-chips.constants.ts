export const AVATAR_CHIP_CLASSES = [
  'avatar-chip-blue',
  'avatar-chip-green',
  'avatar-chip-red',
  'avatar-chip-lav',
  'avatar-chip-warm',
  'avatar-chip-purple',
] as const;

export type AvatarChipClass = (typeof AVATAR_CHIP_CLASSES)[number];
