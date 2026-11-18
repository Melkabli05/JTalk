import { parseDetails, parseLanguages, parseSocial } from './people.parser';

describe('people parsers', () => {
  it('reads a full profile, with the picture as an id and the missing parts empty', () => {
    expect(
      parseDetails({
        id: 'u-1',
        username: 'mona_x',
        displayName: 'Mona',
        bio: 'Coffee and Spanish',
        avatarUrl: '/avatars/avatar-03.svg',
        countryCode: 'MA',
        nativeLanguage: 'ar',
        createdAt: '2026-11-01T10:00:00Z',
      }),
    ).toEqual({
      id: 'u-1',
      username: 'mona_x',
      name: 'Mona',
      bio: 'Coffee and Spanish',
      avatar: 'avatar-03',
      countryCode: 'MA',
      nativeLanguage: 'ar',
      learning: '',
      joinedAt: '2026-11-01T10:00:00Z',
    });
    expect(
      parseDetails({ id: 'u-2', displayName: 'Bo', bio: null, nativeLanguage: 'en' }),
    ).toMatchObject({
      bio: '',
      countryCode: '',
      username: '',
    });
  });

  it('rejects a profile without the essentials', () => {
    expect(() => parseDetails({ id: 'u-1' })).toThrow('expected a profile');
    expect(() => parseDetails('nope')).toThrow('expected a profile');
  });

  it('reads the counts and who follows whom', () => {
    expect(
      parseSocial({ followerCount: 12, followingCount: 3, followedByMe: true, followsMe: false }),
    ).toEqual({
      followers: 12,
      following: 3,
      followedByMe: true,
      followsMe: false,
    });
    expect(() => parseSocial({ followerCount: '12' })).toThrow('expected social stats');
  });

  it('reads native languages and learned ones with their levels, dropping a level it does not know', () => {
    expect(
      parseLanguages({
        userId: 'u-1',
        nativeLanguages: ['ar'],
        learningLanguages: [
          { languageCode: 'es', proficiencyLevel: 'BEGINNER' },
          { languageCode: 'en', proficiencyLevel: null },
          { languageCode: 'de', proficiencyLevel: 'NATIVE' },
          { proficiencyLevel: 'FLUENT' },
        ],
      }),
    ).toEqual({
      native: ['ar'],
      learning: [
        { code: 'es', level: 'BEGINNER' },
        { code: 'en', level: null },
        { code: 'de', level: null },
      ],
    });
    expect(() => parseLanguages({ nativeLanguages: 'ar', learningLanguages: [] })).toThrow(
      'expected a language matrix',
    );
  });
});
