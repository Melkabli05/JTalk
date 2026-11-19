export interface Avatar {
  readonly id: string;
  readonly url: string;
}

const COUNT = 10;

export const AVATARS: readonly Avatar[] = Array.from({ length: COUNT }, (_, index) => {
  const id = `avatar-${String(index + 1).padStart(2, '0')}`;
  return { id, url: `avatars/${id}.svg` };
});

/** The address of a picture a person uploaded: the user service serves it, and the version in it changes with every upload. */
const UPLOADED = /^\/api\/v1\/users\/[0-9a-f-]{36}\/avatar\/\d+$/;

/** An avatar is the id of one of our pictures, or the address of one the person uploaded. Anything else has no picture. */
export function isUploadedAvatar(avatar: string | null | undefined): boolean {
  return uploadedAddress(avatar) !== null;
}

function uploadedAddress(avatar: string | null | undefined): string | null {
  return typeof avatar === 'string' && UPLOADED.test(avatar) ? avatar : null;
}

export function avatarUrl(avatar: string | null | undefined): string | null {
  return (
    uploadedAddress(avatar) ?? AVATARS.find((candidate) => candidate.id === avatar)?.url ?? null
  );
}

export function avatarOrDefault(avatar: string | null | undefined): string {
  return avatarUrl(avatar) === null ? (AVATARS[0]?.id ?? '') : (avatar ?? '');
}

/** What the user service stores as a person's picture: the address of their upload, or the app's own path to a bundled image. */
export function avatarPath(avatar: string): string {
  return uploadedAddress(avatar) ?? `/${avatarUrl(avatarOrDefault(avatar)) ?? ''}`;
}

/** The avatar a stored path stands for: a bundled picture's id, an upload's address, or empty (initials are shown) for anything else. */
export function avatarIdOf(path: string | null | undefined): string {
  return uploadedAddress(path) ?? AVATARS.find((avatar) => path === `/${avatar.url}`)?.id ?? '';
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
