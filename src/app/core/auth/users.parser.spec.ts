import { parsePeople, parsePerson } from './users.parser';

const PROFILE = {
  id: 'm-1',
  username: 'mona_1a2b3c',
  displayName: 'Mona',
  bio: null,
  avatarUrl: '/avatars/avatar-06.svg',
  countryCode: null,
  nativeLanguage: 'ar',
  createdAt: '2026-11-18T10:00:00Z',
};

describe('users parser', () => {
  it('reads a profile as a person, with the bundled picture it names', () => {
    expect(parsePerson(PROFILE)).toEqual({
      id: 'm-1',
      name: 'Mona',
      nativeLanguage: 'ar',
      learning: '',
      avatar: 'avatar-06',
      username: 'mona_1a2b3c',
    });
  });

  it('reads the address of an uploaded picture as it is, and leaves the username out of a summary that has none', () => {
    const address = '/api/v1/users/6f1c2b9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f/avatar/1763560000000';
    const person = parsePerson({ ...PROFILE, avatarUrl: address, username: undefined });

    expect(person.avatar).toBe(address);
    expect('username' in person).toBe(false);
  });

  it('shows initials, not a broken picture, for a picture that is not bundled', () => {
    expect(parsePerson({ ...PROFILE, avatarUrl: 'https://cdn.example.com/a.png' }).avatar).toBe('');
    expect(parsePerson({ ...PROFILE, avatarUrl: null }).avatar).toBe('');
  });

  it('reads a list of summaries', () => {
    expect(
      parsePeople([PROFILE, { ...PROFILE, id: 'm-2', displayName: 'Omar' }]).map((p) => p.name),
    ).toEqual(['Mona', 'Omar']);
  });

  it('reads the languages a full profile carries, and the first one being learned', () => {
    const person = parsePerson({
      ...PROFILE,
      nativeLanguages: ['ar'],
      learningLanguages: [
        { languageCode: 'en', proficiencyLevel: 'BEGINNER' },
        { languageCode: 'fr', proficiencyLevel: 'FLUENT' },
      ],
    });

    expect(person.learning).toBe('en');
    expect(person.languages).toEqual({
      native: ['ar'],
      learning: [
        { code: 'en', level: 'BEGINNER' },
        { code: 'fr', level: 'FLUENT' },
      ],
    });
  });

  it('has no languages for a summary, which does not carry them', () => {
    expect(parsePerson(PROFILE)).not.toHaveProperty('languages');
  });

  it('keeps the bio and country of a full profile, and leaves them out of a summary', () => {
    expect(
      parsePerson({
        id: 'm-1',
        displayName: 'Mona',
        nativeLanguage: 'ar',
        bio: 'Hi',
        countryCode: 'MA',
      }),
    ).toMatchObject({ bio: 'Hi', countryCode: 'MA' });
    expect(
      parsePerson({ id: 'm-1', displayName: 'Mona', nativeLanguage: 'ar' }),
    ).not.toHaveProperty('bio');
  });

  it.each([
    ['a profile without a name', () => parsePerson({ id: 'm-1', nativeLanguage: 'ar' })],
    ['a profile that is not an object', () => parsePerson('nope')],
    ['a list that is not a list', () => parsePeople({})],
  ])('refuses %s', (_name, parse) => {
    expect(parse).toThrow(/Unexpected response/);
  });
});
