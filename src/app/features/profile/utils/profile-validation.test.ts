import { ProfileFormSnapshot } from '../models/profile.model';
import { isProfileDirty, isValidUsername, normalizeUsername } from './profile-validation';

const BASE_SNAPSHOT: ProfileFormSnapshot = {
  name: 'Jilali',
  username: 'test_04ec54',
  avatar: { kind: 'own', id: 'own', bg: '#16121F', label: 'Your own picture' },
  speak: 'Arabic',
  learn: 'English',
  location: 'Not set',
  about: '',
};

describe('profile-validation', () => {
  it('strips leading @ signs and trims whitespace', () => {
    expect(normalizeUsername('  @@mona_1  ')).toBe('mona_1');
  });

  it('validates usernames against the backend 3-30 lowercase/digits/dot/underscore rule', () => {
    expect(isValidUsername('@mona_1.2')).toBe(true);
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('a'.repeat(31))).toBe(false);
    expect(isValidUsername('Mona')).toBe(false);
    expect(isValidUsername('mona-1')).toBe(false);
  });

  it('detects clean vs dirty profile state accurately', () => {
    expect(isProfileDirty({ ...BASE_SNAPSHOT }, BASE_SNAPSHOT)).toBe(false);
    expect(
      isProfileDirty({ ...BASE_SNAPSHOT, username: '@test_04ec54' }, BASE_SNAPSHOT),
    ).toBe(false);
    expect(
      isProfileDirty({ ...BASE_SNAPSHOT, about: 'Hello world' }, BASE_SNAPSHOT),
    ).toBe(true);
    expect(
      isProfileDirty(
        {
          ...BASE_SNAPSHOT,
          avatar: { kind: 'preset', id: 'preset-1', bg: '#2F80ED', label: 'Avatar 1' },
        },
        BASE_SNAPSHOT,
      ),
    ).toBe(true);
  });
});
