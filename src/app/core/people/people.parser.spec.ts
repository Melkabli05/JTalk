import {
  parseDetails,
  parseFollowPage,
  parseLanguages,
  parsePartnerPage,
  parseSocial,
  parseSummaries,
} from './people.parser';

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

  describe('lists of people', () => {
    const ana = {
      id: 'u-1',
      username: 'ana',
      displayName: 'Ana',
      avatarUrl: '/avatars/avatar-03.svg',
      countryCode: 'ES',
      nativeLanguage: 'es',
    };
    const ben = { id: 'u-2', displayName: 'Ben', nativeLanguage: 'en' };

    it('reads each person as a row, with what is missing left empty', () => {
      expect(parseSummaries([ana, ben])).toEqual([
        {
          id: 'u-1',
          username: 'ana',
          name: 'Ana',
          nativeLanguage: 'es',
          learning: '',
          avatar: 'avatar-03',
          countryCode: 'ES',
        },
        {
          id: 'u-2',
          username: '',
          name: 'Ben',
          nativeLanguage: 'en',
          learning: '',
          avatar: '',
          countryCode: '',
        },
      ]);
    });

    it('refuses what is not a list of people', () => {
      expect(() => parseSummaries({})).toThrow('expected a list of users');
      expect(() => parseSummaries([{ id: 'u-1' }])).toThrow('expected a user');
    });

    it('says the next page is the next number while the pages so far do not cover the list', () => {
      expect(parseFollowPage({ content: [ana], page: 0, size: 20, total: 45 }).next).toBe(1);
      expect(parseFollowPage({ content: [ana], page: 1, size: 20, total: 45 }).next).toBe(2);
      expect(parseFollowPage({ content: [ana], page: 2, size: 20, total: 45 }).next).toBeNull();
      expect(parseFollowPage({ content: [], page: 0, size: 20, total: 0 }).next).toBeNull();
      expect(() => parseFollowPage({ content: [] })).toThrow('expected a page of users');
    });

    it('carries the position of the last partner to ask for the next page, and stops on the last', () => {
      const next = {
        content: [ana],
        hasNext: true,
        nextAfterCreatedAt: '2026-11-01T10:00:00Z',
        nextAfterId: 'u-1',
      };
      expect(parsePartnerPage(next).next).toEqual({ createdAt: '2026-11-01T10:00:00Z', id: 'u-1' });
      expect(
        parsePartnerPage({
          content: [ana],
          hasNext: false,
          nextAfterCreatedAt: null,
          nextAfterId: null,
        }).next,
      ).toBeNull();
      expect(() => parsePartnerPage({ content: [] })).toThrow('expected a page of partners');
    });
  });
});
