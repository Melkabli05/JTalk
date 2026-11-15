import { registerLocaleData } from '@angular/common';
import { computed, DOCUMENT, effect, inject, Service, signal } from '@angular/core';
import type { Translation } from '@openng/optimus-ui/api';
import { Optimus } from '@openng/optimus-ui/config';
import { writeItem } from '../safe-storage';
import { LOCALE_STORAGE_KEY, LOCALES, savedLocale, type Locale } from './locales';

interface Bundle {
  readonly locale: Locale;
  readonly messages: Readonly<Record<string, string>>;
  readonly optimus: Translation;
}

const LOADERS: Record<Locale, () => Promise<Partial<Omit<Bundle, 'locale'>>>> = {
  en: () => Promise.resolve({}),
  ar: async () => {
    const [data, { messages }, { optimus }] = await Promise.all([
      import('@angular/common/locales/ar'),
      import('./ar/messages'),
      import('./ar/optimus'),
    ]);
    registerLocaleData(data.default);
    return { messages, optimus };
  },
};

@Service()
export class I18n {
  private readonly optimus = inject(Optimus);
  private readonly document = inject(DOCUMENT);
  private readonly english = structuredClone(this.optimus.translation);
  private readonly bundle = signal<Bundle>({
    locale: 'en',
    messages: {},
    optimus: this.english,
  });

  readonly locale = computed(() => this.bundle().locale);
  readonly direction = computed(() => LOCALES[this.locale()].dir);

  constructor() {
    effect(() => {
      this.document.documentElement.lang = this.locale();
      this.optimus.setTranslation(this.bundle().optimus);
    });
  }

  async init(): Promise<void> {
    await this.apply(savedLocale());
  }

  async use(locale: Locale): Promise<void> {
    await this.apply(locale);
    writeItem('local', LOCALE_STORAGE_KEY, locale);
  }

  t(text: string, params?: object): string {
    const translated = this.bundle().messages[text] ?? text;
    return params
      ? translated.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
          String(Reflect.get(params, name) ?? placeholder),
        )
      : translated;
  }

  private async apply(locale: Locale): Promise<void> {
    this.bundle.set({
      locale,
      messages: {},
      optimus: this.english,
      ...(await LOADERS[locale]()),
    });
  }
}
