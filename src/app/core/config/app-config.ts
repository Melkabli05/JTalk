import { msg } from '@shared/utils/i18n/msg';

export const APP_NAME = msg('Jtalk');

/**
 * Web Storage keys. `index.html` reads the color-scheme and direction keys before first paint to avoid a
 * flash of the wrong theme or layout, so keep those copies in sync.
 */
export const STORAGE_KEYS = {
  token: 'jtalk:token',
  colorScheme: 'jtalk:color-scheme',
  direction: 'jtalk:direction',
} as const;
