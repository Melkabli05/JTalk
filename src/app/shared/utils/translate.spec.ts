import { translate } from './translate';

const scope = (detected: string | undefined, translated = 'Hola') => ({
  LanguageDetector: {
    create: () =>
      Promise.resolve({
        detect: () =>
          Promise.resolve(detected === undefined ? [] : [{ detectedLanguage: detected }]),
      }),
  },
  Translator: {
    create: () => Promise.resolve({ translate: () => Promise.resolve(translated) }),
  },
});

describe('translate', () => {
  it('translates from the language it detects into the one wanted', async () => {
    expect(await translate('Hello', 'es', scope('en'))).toBe('Hola');
  });

  it('gives the text back when it is already in the language wanted', async () => {
    expect(await translate('Hola', 'es', scope('es', 'unused'))).toBe('Hola');
  });

  it('gives nothing when the browser has no translator, or cannot tell the language', async () => {
    expect(await translate('Hello', 'es', {})).toBeUndefined();
    expect(await translate('Hello', 'es', scope(undefined))).toBeUndefined();
  });

  it('gives nothing when the translating fails', async () => {
    const failing = {
      ...scope('en'),
      Translator: { create: () => Promise.reject(new Error('no model')) },
    };

    expect(await translate('Hello', 'es', failing)).toBeUndefined();
  });
});
