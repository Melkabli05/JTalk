import { AVATARS, avatarOrDefault, avatarUrl } from './avatars';

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
