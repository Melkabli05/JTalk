import { AVATAR_CHIP_CLASSES } from '../constants/avatar-chips.constants';
import { avatarChipClassFor } from './avatar-chip.utils';

describe('avatarChipClassFor', () => {
  it('returns a deterministic palette class for any id', () => {
    const first = avatarChipClassFor('user-42');
    const second = avatarChipClassFor('user-42');
    expect(first).toBe(second);
    expect(AVATAR_CHIP_CLASSES).toContain(first);
  });

  it('handles empty strings without throwing', () => {
    expect(avatarChipClassFor('')).toBe(AVATAR_CHIP_CLASSES[0]);
  });
});
