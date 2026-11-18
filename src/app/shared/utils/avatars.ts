export interface Avatar {
  readonly id: string;
  readonly url: string;
}

const COUNT = 10;

export const AVATARS: readonly Avatar[] = Array.from({ length: COUNT }, (_, index) => {
  const id = `avatar-${String(index + 1).padStart(2, '0')}`;
  return { id, url: `avatars/${id}.svg` };
});

export function avatarUrl(id: string | null | undefined): string | null {
  return AVATARS.find((avatar) => avatar.id === id)?.url ?? null;
}

export function avatarOrDefault(id: string | null | undefined): string {
  return avatarUrl(id) === null ? (AVATARS[0]?.id ?? '') : (id ?? '');
}

/** What the user service stores as a person's picture: the app's own path to the bundled image, valid on whichever origin shows it. */
export function avatarPath(id: string): string {
  return `/${avatarUrl(avatarOrDefault(id)) ?? ''}`;
}

/** The bundled picture a stored path names, or an empty id (initials are shown) for anything else. */
export function avatarIdOf(path: string | null | undefined): string {
  return AVATARS.find((avatar) => path === `/${avatar.url}`)?.id ?? '';
}

/** The three tones a person without a picture is drawn in (Forest, Sand, Coral): the same person always gets the same one. */
const PALETTE = [
  { background: 'var(--p-jtalk-tone-green)', color: '#fff' },
  { background: 'var(--p-jtalk-tone-gold)', color: '#252525' },
  { background: 'var(--p-jtalk-tone-coral)', color: '#fff' },
] as const;

function seedHash(seed: string): number {
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
