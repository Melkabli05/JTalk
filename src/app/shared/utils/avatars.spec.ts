import {
  avatarColors,
  AVATARS,
  avatarIdOf,
  avatarOrDefault,
  avatarPath,
  avatarUrl,
} from './avatars';

describe('avatars', () => {
  it('offers ten distinct pictures, numbered from 01', () => {
    expect(AVATARS).toHaveLength(10);
    expect(AVATARS[0]).toEqual({ id: 'avatar-01', url: 'avatars/avatar-01.svg' });
    expect(AVATARS[9]?.id).toBe('avatar-10');
    expect(new Set(AVATARS.map((avatar) => avatar.url)).size).toBe(10);
  });

  it('finds the picture of a known id', () => {
    expect(avatarUrl('avatar-04')).toBe('avatars/avatar-04.svg');
  });

  it.each([null, undefined, '', 'avatar-99', '../secret'])('has no picture for %j', (id) => {
    expect(avatarUrl(id)).toBeNull();
  });

  it('starts from the first picture unless the person already has one of ours', () => {
    expect(avatarOrDefault('avatar-07')).toBe('avatar-07');
    expect(avatarOrDefault('')).toBe('avatar-01');
    expect(avatarOrDefault('nope')).toBe('avatar-01');
    expect(avatarOrDefault(undefined)).toBe('avatar-01');
  });
});

describe('avatar paths', () => {
  it('stores a picture as the path of the bundled image and reads the id back', () => {
    expect(avatarPath('avatar-03')).toBe('/avatars/avatar-03.svg');
    expect(avatarIdOf('/avatars/avatar-03.svg')).toBe('avatar-03');
  });

  it('falls back to the first picture for an id that is not bundled', () => {
    expect(avatarPath('nope')).toBe('/avatars/avatar-01.svg');
  });

  it('knows no id for a path that is not a bundled picture', () => {
    expect(avatarIdOf('https://cdn.example.com/a.png')).toBe('');
    expect(avatarIdOf(null)).toBe('');
    expect(avatarIdOf('/avatars/other.svg')).toBe('');
  });

  it('gives the same person the same color every time, always one of the three primaries', () => {
    expect(avatarColors('u-42')).toEqual(avatarColors('u-42'));
    const backgrounds = new Set(
      ['u-1', 'u-2', 'u-3', 'u-4', 'u-5', 'u-6'].map(
        (id) => avatarColors(id)['--p-avatar-background'],
      ),
    );
    expect([...backgrounds].every((value) => /tone-(green|gold|coral)/.test(value))).toBe(true);
    expect(backgrounds.size).toBeGreaterThan(1);
  });
});
