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
