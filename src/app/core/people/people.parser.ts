import { asRecord, isStringList } from '@shared/utils/as-record';
import { avatarIdOf } from '@shared/utils/avatars';
import {
  isProficiency,
  type LanguageMatrix,
  type LearningLanguage,
  type SocialStats,
} from '@shared/utils/people';
import type { PersonDetails } from './person-card.model';

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function parseDetails(raw: unknown): PersonDetails {
  const user = asRecord(raw);
  if (
    user === undefined ||
    typeof user['id'] !== 'string' ||
    typeof user['displayName'] !== 'string' ||
    typeof user['nativeLanguage'] !== 'string'
  ) {
    throw new Error('Unexpected response: expected a profile');
  }
  return {
    id: user['id'],
    name: user['displayName'],
    nativeLanguage: user['nativeLanguage'],
    learning: '',
    avatar: avatarIdOf(typeof user['avatarUrl'] === 'string' ? user['avatarUrl'] : null),
    username: text(user['username']),
    bio: text(user['bio']),
    countryCode: text(user['countryCode']),
    joinedAt: text(user['createdAt']),
  };
}

export function parseSocial(raw: unknown): SocialStats {
  const stats = asRecord(raw);
  if (
    stats === undefined ||
    typeof stats['followerCount'] !== 'number' ||
    typeof stats['followingCount'] !== 'number'
  ) {
    throw new Error('Unexpected response: expected social stats');
  }
  return {
    followers: stats['followerCount'],
    following: stats['followingCount'],
    followedByMe: stats['followedByMe'] === true,
    followsMe: stats['followsMe'] === true,
  };
}

export function parseLanguages(raw: unknown): LanguageMatrix {
  const matrix = asRecord(raw);
  const learning = matrix?.['learningLanguages'];
  if (
    matrix === undefined ||
    !isStringList(matrix['nativeLanguages']) ||
    !Array.isArray(learning)
  ) {
    throw new Error('Unexpected response: expected a language matrix');
  }
  return {
    native: matrix['nativeLanguages'],
    learning: learning.flatMap((entry: unknown): LearningLanguage[] => {
      const language = asRecord(entry);
      const code = language?.['languageCode'];
      const level = language?.['proficiencyLevel'];
      return typeof code === 'string' ? [{ code, level: isProficiency(level) ? level : null }] : [];
    }),
  };
}
