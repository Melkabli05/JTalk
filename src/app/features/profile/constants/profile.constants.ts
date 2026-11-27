import type { ProficiencyLevel } from '../../../core/auth/auth.models';

export type ProfileTab = 'overview' | 'edit' | 'account';

export const PROFILE_TAB_ORDER: readonly ProfileTab[] = ['overview', 'edit', 'account'];
export const PROFILE_CONNECTIONS_PAGE_SIZE = 30;

// Backend-verified limits (JTalk-user-service: UserConstants.java, UserProperties.java, AvatarImages.java)
export const PROFILE_DISPLAY_NAME_MAX = 50;
export const PROFILE_BIO_MAX = 300;
export const PROFILE_USERNAME_MIN = 3;
export const PROFILE_USERNAME_MAX = 30;
export const PROFILE_USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;
export const PROFILE_USERNAME_COOLDOWN_DAYS = 30;
export const PROFILE_MAX_LANGUAGES = 20;

export const PROFILE_AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_AVATAR_MIN_PX = 64;
export const PROFILE_AVATAR_MAX_DECODE_PX = 4096;
export const PROFILE_AVATAR_EXPORT_PX = 512;
export const PROFILE_AVATAR_TARGET_MAX_BYTES = 204_800;
export const PROFILE_AVATAR_ACCEPTED_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
]);

export const PROFICIENCY_LEVELS: readonly ProficiencyLevel[] = [
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
  'FLUENT',
];

export const PROFILE_PROBLEM_TYPES = {
  usernameTaken: 'urn:jtalk:user:problem:username-taken',
  usernameChangeTooSoon: 'urn:jtalk:user:problem:username-change-too-soon',
  avatarInvalid: 'urn:jtalk:user:problem:avatar-invalid',
  languageConflict: 'urn:jtalk:user:problem:language-conflict',
  tooManyLanguages: 'urn:jtalk:user:problem:too-many-languages',
  primaryLanguageRequired: 'urn:jtalk:user:problem:primary-language-required',
} as const;

export function parseProfileTab(raw: string | null): ProfileTab | null {
  return raw === 'overview' || raw === 'edit' || raw === 'account' ? raw : null;
}
