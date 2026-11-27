import {
  buildOrderedLanguageRows,
  displayCountryName,
  displayLanguageName,
  formatFollowerLabel,
  formatFollowingLabel,
  formatJoinedMonth,
  formatProficiencyLevel,
  nativeLanguageName,
  normalizeUsername,
  proficiencyBarsCount,
  profileInitials,
} from './profile-format.utils';

describe('profile-format.utils', () => {
  it('formats follower/following counts with Intl.PluralRules', () => {
    expect(formatFollowerLabel(0, 'en-US').fullText).toBe('0 followers');
    expect(formatFollowerLabel(1, 'en-US').fullText).toBe('1 follower');
    expect(formatFollowerLabel(2, 'en-US').fullText).toBe('2 followers');
    expect(formatFollowerLabel(1250, 'en-US').fullText).toBe('1,250 followers');
    expect(formatFollowingLabel(1, 'en-US').fullText).toBe('1 following');
    expect(formatFollowingLabel(14, 'en-US').fullText).toBe('14 following');
  });

  it('formats language names, native script names, and country names with Intl.DisplayNames', () => {
    expect(displayLanguageName('ar', 'en')).toBe('Arabic');
    expect(nativeLanguageName('ar', 'Arabic')).toBe('العربية');
    expect(nativeLanguageName('en', 'English')).toBeNull();
    expect(displayCountryName('MA', 'en')).toBe('Morocco');
    expect(displayCountryName('JP', 'en')).toBe('Japan');
    expect(displayCountryName(null, 'en')).toBe('');
  });

  it('orders languages with primary native first, secondary native next, then learning with level bars', () => {
    const rows = buildOrderedLanguageRows(
      {
        nativeLanguage: 'ar',
        nativeLanguages: ['fr', 'ar'],
        learningLanguages: [
          { languageCode: 'ja', proficiencyLevel: 'INTERMEDIATE' },
          { languageCode: 'en', proficiencyLevel: 'ADVANCED' },
        ],
      },
      'en',
    );
    expect(rows.map((r) => `${r.code}:${r.role}:${r.isPrimaryNative}:${r.level ?? 'none'}`)).toEqual(
      [
        'ar:NATIVE:true:none',
        'fr:NATIVE:false:none',
        'ja:LEARNING:false:INTERMEDIATE',
        'en:LEARNING:false:ADVANCED',
      ],
    );
    expect(rows[0]?.nativeName).toBe('العربية');
    expect(rows[2]?.nativeName).toBe('日本語');
  });

  it('formats joined dates, proficiency levels, bars, usernames, and initials', () => {
    expect(formatJoinedMonth('2026-11-15T12:00:00Z', 'en-US')).toBe('November 2026');
    expect(formatJoinedMonth('invalid', 'en-US')).toBe('');
    expect(formatProficiencyLevel('FLUENT')).toBe('Fluent');
    expect(proficiencyBarsCount('BEGINNER')).toBe(1);
    expect(proficiencyBarsCount('INTERMEDIATE')).toBe(2);
    expect(proficiencyBarsCount('ADVANCED')).toBe(3);
    expect(proficiencyBarsCount('FLUENT')).toBe(4);
    expect(normalizeUsername('  @Mona_99 ')).toBe('mona_99');
    expect(profileInitials('Yuki Sato')).toBe('YS');
    expect(profileInitials('محمد علي')).toBe('مع');
  });
});
