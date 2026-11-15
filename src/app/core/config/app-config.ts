import { msg } from '@shared/utils/i18n/msg';

export const APP_NAME = msg('Jtalk');

export const STORAGE_KEYS = {
  token: 'jtalk:token',
  profile: 'jtalk:profile',
  colorScheme: 'jtalk:color-scheme',
  direction: 'jtalk:direction',
} as const;
