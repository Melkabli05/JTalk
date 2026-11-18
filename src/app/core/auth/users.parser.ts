import { asRecord } from '@shared/utils/as-record';
import { avatarIdOf } from '@shared/utils/avatars';
import { readLanguages } from '@shared/utils/people';
import type { Person } from './identity.models';

/** Reads a profile or a summary from the user service. A summary has no languages, so the language being learned stays empty. */
function readPerson(raw: unknown): Person | undefined {
  const user = asRecord(raw);
  if (
    user === undefined ||
    typeof user['id'] !== 'string' ||
    typeof user['displayName'] !== 'string' ||
    typeof user['nativeLanguage'] !== 'string'
  ) {
    return undefined;
  }
  const picture = user['avatarUrl'];
  const languages = readLanguages(user);
  return {
    id: user['id'],
    name: user['displayName'],
    nativeLanguage: user['nativeLanguage'],
    learning: languages?.learning[0]?.code ?? '',
    avatar: avatarIdOf(typeof picture === 'string' ? picture : null),
    ...(typeof user['bio'] === 'string' ? { bio: user['bio'] } : {}),
    ...(typeof user['countryCode'] === 'string' ? { countryCode: user['countryCode'] } : {}),
    ...(languages ? { languages } : {}),
  };
}

export function parsePerson(raw: unknown): Person {
  const person = readPerson(raw);
  if (person === undefined) {
    throw new Error('Unexpected response: expected a profile');
  }
  return person;
}

export function parsePeople(raw: unknown): Person[] {
  if (!Array.isArray(raw)) {
    throw new Error('Unexpected response: expected a list of profiles');
  }
  return raw.map((item) => parsePerson(item));
}
