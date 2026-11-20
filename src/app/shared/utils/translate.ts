interface Translating {
  translate(text: string): Promise<string>;
}

interface Detecting {
  detect(text: string): Promise<readonly { detectedLanguage: string }[]>;
}

/** The translation and language-detection APIs some browsers have built in (they work on the device, so the text goes nowhere). */
interface Scope {
  readonly Translator?: {
    create(options: { sourceLanguage: string; targetLanguage: string }): Promise<Translating>;
  };
  readonly LanguageDetector?: { create(): Promise<Detecting> };
}

/**
 * The text in the language wanted, with the browser's own translator: the language it is written in is detected first. Undefined when the
 * browser has no translator, cannot tell the language, or cannot translate between the two; the text is returned as it is when it already is
 * in that language.
 */
export async function translate(
  text: string,
  target: string,
  where: object = globalThis,
): Promise<string | undefined> {
  const scope = where as Scope;
  if (scope.Translator === undefined || scope.LanguageDetector === undefined) {
    return undefined;
  }
  try {
    const detector = await scope.LanguageDetector.create();
    const [guess] = await detector.detect(text);
    if (guess === undefined) {
      return undefined;
    }
    if (guess.detectedLanguage === target) {
      return text;
    }
    const translator = await scope.Translator.create({
      sourceLanguage: guess.detectedLanguage,
      targetLanguage: target,
    });
    return await translator.translate(text);
  } catch {
    return undefined;
  }
}
