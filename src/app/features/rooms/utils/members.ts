import type { Person } from '@core/auth/identity.models';

export function memberOf(members: ReadonlyMap<string, Person>, id: string): Person {
  return (
    members.get(id) ?? { id, name: id.slice(0, 8), nativeLanguage: '', learning: '', avatar: '' }
  );
}
