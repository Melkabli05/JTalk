import {
  compactCount,
  countryNameOf,
  flagOf,
  isProficiency,
  partnerMatch,
  proficiencyShare,
  readLanguages,
  type LanguageMatrix,
} from './people';

const me: LanguageMatrix = {
  native: ['ar'],
  learning: [{ code: 'es', level: 'BEGINNER' }],
};

describe('partnerMatch', () => {
  it('is an exchange when they speak what I learn and learn what I speak', () => {
    const them: LanguageMatrix = {
      native: ['es'],
      learning: [{ code: 'ar', level: 'INTERMEDIATE' }],
    };

    expect(partnerMatch(me, them)).toEqual({ kind: 'exchange', theySpeak: 'es', theyLearn: 'ar' });
  });

  it('can teach me when they only speak what I learn', () => {
    const them: LanguageMatrix = { native: ['es'], learning: [{ code: 'de', level: null }] };

    expect(partnerMatch(me, them)).toEqual({ kind: 'teaches-you', theySpeak: 'es' });
  });

  it('learns mine when they only learn what I speak', () => {
    const them: LanguageMatrix = { native: ['fr'], learning: [{ code: 'ar', level: 'FLUENT' }] };

    expect(partnerMatch(me, them)).toEqual({ kind: 'learns-yours', theyLearn: 'ar' });
  });

  it('is nothing when the languages do not meet', () => {
    const them: LanguageMatrix = { native: ['fr'], learning: [{ code: 'de', level: null }] };

    expect(partnerMatch(me, them)).toEqual({ kind: 'none' });
  });

  it('uses every language they speak or learn, not only the first', () => {
    const them: LanguageMatrix = {
      native: ['fr', 'es'],
      learning: [
        { code: 'de', level: null },
        { code: 'ar', level: null },
      ],
    };

    expect(partnerMatch(me, them)).toEqual({ kind: 'exchange', theySpeak: 'es', theyLearn: 'ar' });
  });
});

describe('people helpers', () => {
  it('fills a quarter of the meter for each level', () => {
    expect(
      ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'FLUENT'].map((level) =>
        proficiencyShare(level as never),
      ),
    ).toEqual([25, 50, 75, 100]);
  });

  it('knows a proficiency when it sees one', () => {
    expect(isProficiency('FLUENT')).toBe(true);
    expect(isProficiency('NATIVE')).toBe(false);
    expect(isProficiency(null)).toBe(false);
  });

  it('draws a flag from a country code, and nothing from a bad one', () => {
    expect(flagOf('ma')).toBe('🇲🇦');
    expect(flagOf('MAR')).toBe('');
    expect(flagOf('')).toBe('');
  });

  it('names a country in the reader language, falling back to the code', () => {
    expect(countryNameOf('MA', 'en')).toBe('Morocco');
    expect(countryNameOf('MA', 'ar')).toBe('المغرب');
    expect(countryNameOf('??', 'en')).toBe('??');
  });

  it('shortens big counts', () => {
    expect(compactCount(980, 'en')).toBe('980');
    expect(compactCount(1250, 'en')).toBe('1.3K');
    expect(compactCount(2_400_000, 'en')).toBe('2.4M');
  });
});

describe('readLanguages', () => {
  it('reads native languages and learned ones with their levels, dropping a level it does not know', () => {
    expect(
      readLanguages({
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
  });

  it('has nothing to read when the response carries no languages', () => {
    expect(readLanguages({ id: 'u-1' })).toBeUndefined();
    expect(readLanguages({ nativeLanguages: 'ar', learningLanguages: [] })).toBeUndefined();
    expect(readLanguages('nope')).toBeUndefined();
  });
});
