export const APP_BRAND_NAME = 'Jtalk';
export const APP_DEFAULT_TITLE = 'Jtalk — Language Speaking Practice Rooms';
export const TITLE_SEPARATOR = ' · ';

export interface AppTitleConfig {
  readonly brand: string;
  readonly defaultTitle: string;
  readonly separator: string;
}

export const DEFAULT_APP_TITLE_CONFIG: AppTitleConfig = {
  brand: APP_BRAND_NAME,
  defaultTitle: APP_DEFAULT_TITLE,
  separator: TITLE_SEPARATOR,
};

/**
 * Formats a route or page title using the app-wide `<Page> · <Brand>` convention.
 * Falls back cleanly when empty and avoids duplicating the brand name.
 */
export function formatDocumentTitle(
  pageTitle: string | undefined | null,
  config: AppTitleConfig = DEFAULT_APP_TITLE_CONFIG,
): string {
  const trimmed = pageTitle?.trim() ?? '';
  if (!trimmed) {
    return config.defaultTitle;
  }

  const normalizedBrand = config.brand.toLowerCase();
  const normalizedTitle = trimmed.toLowerCase();

  if (normalizedTitle === normalizedBrand) {
    return config.brand;
  }

  const suffix = `${config.separator}${config.brand}`;
  if (normalizedTitle.endsWith(suffix.toLowerCase())) {
    return trimmed;
  }

  if (
    normalizedTitle.startsWith(`${normalizedBrand} — `) ||
    normalizedTitle.startsWith(`${normalizedBrand} - `) ||
    normalizedTitle.startsWith(`${normalizedBrand} · `)
  ) {
    return trimmed;
  }

  return `${trimmed}${suffix}`;
}
