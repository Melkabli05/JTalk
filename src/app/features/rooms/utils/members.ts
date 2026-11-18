import type { Person } from '@core/auth/identity.models';

export function memberOf(members: ReadonlyMap<string, Person>, id: string): Person {
  return (
    members.get(id) ?? { id, name: id.slice(0, 8), nativeLanguage: '', learning: '', avatar: '' }
  );
}

const PALETTE = [
  { background: 'var(--p-jtalk-tone-green)', color: '#fff' },
  { background: 'var(--p-jtalk-tone-gold)', color: '#252525' },
  { background: 'var(--p-jtalk-tone-coral)', color: '#fff' },
] as const;

export function seedHash(seed: string): number {
  return [...seed].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 997, 7);
}

export function blockColors(seed: string): { background: string; color: string } {
  return PALETTE[seedHash(seed) % PALETTE.length] ?? PALETTE[0];
}

export function avatarColors(id: string): {
  '--p-avatar-background': string;
  '--p-avatar-color': string;
} {
  const { background, color } = blockColors(id);
  return { '--p-avatar-background': background, '--p-avatar-color': color };
}
