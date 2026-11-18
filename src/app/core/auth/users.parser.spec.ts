import { parseLearningLanguages, parsePeople, parsePerson } from './users.parser';

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
    });
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

  it('reads the languages being learned from the matrix', () => {
    expect(
      parseLearningLanguages({
        userId: 'm-1',
        nativeLanguages: ['ar'],
        learningLanguages: [
          { languageCode: 'en', proficiencyLevel: 'BEGINNER' },
          { languageCode: 'fr', proficiencyLevel: 'FLUENT' },
        ],
      }),
    ).toEqual(['en', 'fr']);
  });

  it.each([
    ['a profile without a name', () => parsePerson({ id: 'm-1', nativeLanguage: 'ar' })],
    ['a profile that is not an object', () => parsePerson('nope')],
    ['a list that is not a list', () => parsePeople({})],
    ['a matrix without languages', () => parseLearningLanguages({})],
    ['a language without a code', () => parseLearningLanguages({ learningLanguages: [{}] })],
  ])('refuses %s', (_name, parse) => {
    expect(parse).toThrow(/Unexpected response/);
  });
});
