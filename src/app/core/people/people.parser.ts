import { asRecord } from '@shared/utils/as-record';
import { avatarIdOf } from '@shared/utils/avatars';
import { readLanguages, type PersonSummary, type SocialStats } from '@shared/utils/people';
import type { Page } from '@shared/utils/paged-list';
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
  const languages = readLanguages(user);
  return {
    id: user['id'],
    name: user['displayName'],
    nativeLanguage: user['nativeLanguage'],
    learning: languages?.learning[0]?.code ?? '',
    avatar: avatarIdOf(typeof user['avatarUrl'] === 'string' ? user['avatarUrl'] : null),
    username: text(user['username']),
    bio: text(user['bio']),
    countryCode: text(user['countryCode']),
    joinedAt: text(user['createdAt']),
    ...(languages ? { languages } : {}),
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

function readSummary(raw: unknown): PersonSummary {
  const user = asRecord(raw);
  if (
    user === undefined ||
    typeof user['id'] !== 'string' ||
    typeof user['displayName'] !== 'string' ||
    typeof user['nativeLanguage'] !== 'string'
  ) {
    throw new Error('Unexpected response: expected a user');
  }
  return {
    id: user['id'],
    name: user['displayName'],
    nativeLanguage: user['nativeLanguage'],
    learning: '',
    avatar: avatarIdOf(typeof user['avatarUrl'] === 'string' ? user['avatarUrl'] : null),
    username: text(user['username']),
    countryCode: text(user['countryCode']),
  };
}

export function parseSummaries(raw: unknown): PersonSummary[] {
  if (!Array.isArray(raw)) {
    throw new Error('Unexpected response: expected a list of users');
  }
  return raw.map(readSummary);
}

/** A page of followers or following: the next one is the next page number, until the pages read cover the whole list. */
export function parseFollowPage(raw: unknown): Page<PersonSummary, number> {
  const page = asRecord(raw);
  if (
    page === undefined ||
    typeof page['page'] !== 'number' ||
    typeof page['size'] !== 'number' ||
    typeof page['total'] !== 'number'
  ) {
    throw new Error('Unexpected response: expected a page of users');
  }
  const items = parseSummaries(page['content']);
  return {
    items,
    next: (page['page'] + 1) * page['size'] < page['total'] ? page['page'] + 1 : null,
  };
}

/** Where the next page of partners starts, as the service wants it: the last person's position. */
export interface PartnerCursor {
  readonly createdAt: string;
  readonly id: string;
}

export function parsePartnerPage(raw: unknown): Page<PersonSummary, PartnerCursor> {
  const page = asRecord(raw);
  if (page === undefined || typeof page['hasNext'] !== 'boolean') {
    throw new Error('Unexpected response: expected a page of partners');
  }
  const createdAt = page['nextAfterCreatedAt'];
  const id = page['nextAfterId'];
  return {
    items: parseSummaries(page['content']),
    next:
      page['hasNext'] && typeof createdAt === 'string' && typeof id === 'string'
        ? { createdAt, id }
        : null,
  };
}
