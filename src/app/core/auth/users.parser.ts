import { asRecord } from '@shared/utils/as-record';
import { avatarIdOf } from '@shared/utils/avatars';
import type { Person } from './identity.models';

/** Reads a profile or a summary from the user service. Others' learning language is not part of a summary, so it stays empty. */
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
  return {
    id: user['id'],
    name: user['displayName'],
    nativeLanguage: user['nativeLanguage'],
    learning: '',
    avatar: avatarIdOf(typeof picture === 'string' ? picture : null),
    ...(typeof user['bio'] === 'string' ? { bio: user['bio'] } : {}),
    ...(typeof user['countryCode'] === 'string' ? { countryCode: user['countryCode'] } : {}),
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

/** The codes of the languages being learned, from the language matrix. */
export function parseLearningLanguages(raw: unknown): string[] {
  const learning = asRecord(raw)?.['learningLanguages'];
  if (!Array.isArray(learning)) {
    throw new Error('Unexpected response: expected a language matrix');
  }
  return learning.map((entry) => {
    const code = asRecord(entry)?.['languageCode'];
    if (typeof code !== 'string') {
      throw new Error('Unexpected response: expected a language code');
    }
    return code;
  });
}
