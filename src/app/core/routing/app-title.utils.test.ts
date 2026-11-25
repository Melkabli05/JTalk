import {
  APP_BRAND_NAME,
  APP_DEFAULT_TITLE,
  formatDocumentTitle,
} from './app-title.utils';

describe('formatDocumentTitle', () => {
  it('returns the default title when route title is empty or missing', () => {
    expect(formatDocumentTitle(undefined)).toBe(APP_DEFAULT_TITLE);
    expect(formatDocumentTitle(null)).toBe(APP_DEFAULT_TITLE);
    expect(formatDocumentTitle('   ')).toBe(APP_DEFAULT_TITLE);
  });

  it('appends the brand suffix with page-first ordering', () => {
    expect(formatDocumentTitle('Live rooms')).toBe('Live rooms · Jtalk');
    expect(formatDocumentTitle('  People  ')).toBe('People · Jtalk');
  });

  it('prevents duplicating the brand name when already present', () => {
    expect(formatDocumentTitle(APP_BRAND_NAME)).toBe(APP_BRAND_NAME);
    expect(formatDocumentTitle('Profile · Jtalk')).toBe('Profile · Jtalk');
    expect(formatDocumentTitle('Jtalk — Live rooms')).toBe('Jtalk — Live rooms');
  });

  it('supports custom brand configuration overrides', () => {
    expect(
      formatDocumentTitle('Settings', {
        brand: 'Acme',
        defaultTitle: 'Acme App',
        separator: ' | ',
      }),
    ).toBe('Settings | Acme');
  });
});
