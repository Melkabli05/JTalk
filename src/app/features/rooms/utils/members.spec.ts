import { avatarColors, memberOf } from './members';

describe('member helpers', () => {
  it('shows the person the directory knows, and the start of the id for anyone else', () => {
    const ada = { id: 'a-1', name: 'Ada', nativeLanguage: 'en', learning: 'ar', avatar: '' };

    expect(memberOf(new Map([['a-1', ada]]), 'a-1')).toBe(ada);
    expect(memberOf(new Map(), '1f9d2c0e-aaaa-bbbb').name).toBe('1f9d2c0e');
  });

  it('gives the same person the same color every time, always one of the three primaries', () => {
    expect(avatarColors('u-42')).toEqual(avatarColors('u-42'));
    const backgrounds = new Set(
      ['u-1', 'u-2', 'u-3', 'u-4', 'u-5', 'u-6'].map(
        (id) => avatarColors(id)['--p-avatar-background'],
      ),
    );
    expect([...backgrounds].every((value) => /bauhaus-(red|yellow|blue)/.test(value))).toBe(true);
    expect(backgrounds.size).toBeGreaterThan(1);
  });
});
