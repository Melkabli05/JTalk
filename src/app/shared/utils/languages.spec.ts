import { languageOf, LANGUAGES } from './languages';

describe('languages', () => {
  it('knows the offered languages', () => {
    expect(languageOf('es')).toEqual(LANGUAGES.find((language) => language.code === 'es'));
    expect(LANGUAGES.map((language) => language.code)).toContain('ar');
  });

  it('shows an unknown code as it is, with a neutral flag', () => {
    expect(languageOf('xx')).toEqual({ code: 'xx', flag: '🏳️', name: 'xx' });
  });
});
