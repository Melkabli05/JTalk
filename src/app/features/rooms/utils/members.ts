import type { Member } from '../models/room.model';

/** Who to show for an id: the person the identity layer knows, or the start of the id when it knows nobody. */
export function memberOf(members: ReadonlyMap<string, Member>, id: string): Member {
  return (
    members.get(id) ?? { id, name: id.slice(0, 8), nativeLanguage: '', learning: '', avatar: '' }
  );
}

const PALETTE = [
  { background: 'var(--p-jtalk-bauhaus-red)', color: '#fff' },
  { background: 'var(--p-jtalk-bauhaus-yellow)', color: '#111' },
  { background: 'var(--p-jtalk-bauhaus-blue)', color: '#fff' },
] as const;

/** A steady Bauhaus primary (and the text color that reads on it) for any seed: a person's id, a language code. */
export function blockColors(seed: string): { background: string; color: string } {
  const hash = [...seed].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 997, 7);
  return PALETTE[hash % PALETTE.length] ?? PALETTE[0];
}

/** The same colors as the CSS variables an Optimus avatar reads. */
export function avatarColors(id: string): {
  '--p-avatar-background': string;
  '--p-avatar-color': string;
} {
  const { background, color } = blockColors(id);
  return { '--p-avatar-background': background, '--p-avatar-color': color };
}
