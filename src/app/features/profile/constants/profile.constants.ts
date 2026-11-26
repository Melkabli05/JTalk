import { ProfileTab } from '../../../core/models/session.model';
import { COUNTRY_NAMES, LANGUAGE_NAMES } from '../../../core/utils/language-codes';

export const PROFILE_TAB_ORDER: readonly ProfileTab[] = ['overview', 'edit', 'account'];
export const PROFILE_CONNECTIONS_PAGE_SIZE = 30;

export const PROFILE_SPEAK_OPTIONS: readonly string[] = LANGUAGE_NAMES;

export const PROFILE_LEARN_OPTIONS: readonly string[] = ['Not set', ...LANGUAGE_NAMES];

export const PROFILE_LOCATION_OPTIONS: readonly string[] = ['Not set', ...COUNTRY_NAMES];
