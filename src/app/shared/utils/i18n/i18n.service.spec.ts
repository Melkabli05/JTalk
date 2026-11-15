import { TestBed } from '@angular/core/testing';
import { Optimus } from '@openng/optimus-ui/config';
import { messages } from './ar/messages';
import { I18n } from './i18n.service';
import { LOCALE_STORAGE_KEY } from './locales';

describe('I18n', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
  });
  afterEach(async () => {
    await TestBed.inject(I18n).use('en');
    localStorage.clear();
  });

  it('starts in English when nothing is saved, and in Arabic when that is saved', async () => {
    const i18n = TestBed.inject(I18n);
    await i18n.init();
    expect(i18n.locale()).toBe('en');
    expect(i18n.direction()).toBe('ltr');
    expect(i18n.t('Sign in')).toBe('Sign in');

    TestBed.resetTestingModule();
    localStorage.setItem(LOCALE_STORAGE_KEY, 'ar');
    const arabic = TestBed.inject(I18n);
    await arabic.init();
    expect(arabic.locale()).toBe('ar');
    expect(arabic.direction()).toBe('rtl');
    expect(arabic.t('Sign in')).toBe(messages['Sign in']);
  });

  it('translates into Arabic, and falls back to the English for a text it does not know', async () => {
    const i18n = TestBed.inject(I18n);
    await i18n.use('ar');

    expect(i18n.t('Sign in')).toBe(messages['Sign in']);
    expect(i18n.t('A text nobody translated')).toBe('A text nobody translated');
    expect(i18n.direction()).toBe('rtl');
  });

  it('puts values into {placeholders}, and leaves the ones it is not given', async () => {
    const i18n = TestBed.inject(I18n);
    await i18n.use('ar');

    expect(i18n.t('Use at least {minLength} characters.', { minLength: 12 })).toBe(
      'استخدم 12 أحرف على الأقل.',
    );
    expect(i18n.t('At least {min} characters.')).toBe('{min} أحرف على الأقل.');
    await i18n.use('en');
    expect(i18n.t('Use at least {minLength} characters.', { minLength: 7 })).toBe(
      'Use at least 7 characters.',
    );
  });

  it('remembers the language, and applies it at startup', async () => {
    await TestBed.inject(I18n).use('ar');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ar');

    TestBed.resetTestingModule();
    const restarted = TestBed.inject(I18n);
    await restarted.init();
    expect(restarted.locale()).toBe('ar');
  });

  it('ignores a saved language it does not offer', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'xx');
    const i18n = TestBed.inject(I18n);
    await i18n.init();
    expect(i18n.locale()).toBe('en');
  });

  it('sets the lang of the page', async () => {
    const i18n = TestBed.inject(I18n);
    await i18n.use('ar');
    TestBed.tick();
    expect(document.documentElement.lang).toBe('ar');
    await i18n.use('en');
    TestBed.tick();
    expect(document.documentElement.lang).toBe('en');
  });

  it('gives the Optimus components their strings, and takes them back for English', async () => {
    const i18n = TestBed.inject(I18n);
    const optimus = TestBed.inject(Optimus);

    await i18n.use('ar');
    TestBed.tick();
    expect(optimus.getTranslation('accept')).toBe('نعم');
    expect(optimus.getTranslation('firstDayOfWeek')).toBe(6);

    await i18n.use('en');
    TestBed.tick();
    expect(optimus.getTranslation('accept')).toBe('Yes');
    expect(optimus.getTranslation('firstDayOfWeek')).toBe(0);
  });

  it('has Angular locale data, so the date and currency pipes can speak Arabic', async () => {
    await TestBed.inject(I18n).use('ar');
    const { formatDate, formatCurrency } = await import('@angular/common');

    expect(formatDate(new Date(2026, 5, 3), 'MMMM', 'ar')).toBe('يونيو');
    expect(formatCurrency(245, 'ar', '$', 'USD')).toContain('245.00');
  });
});
