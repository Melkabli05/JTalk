export interface Avatar {
  readonly id: string;
  readonly url: string;
}

const COUNT = 10;

/** The pictures a person can choose from, bundled with the app (`public/avatars`, see its README for the source and license). */
export const AVATARS: readonly Avatar[] = Array.from({ length: COUNT }, (_, index) => {
  const id = `avatar-${String(index + 1).padStart(2, '0')}`;
  return { id, url: `avatars/${id}.svg` };
});

/** Where the picture with this id is, or null for an empty or unknown id (the person is then shown by their initials). */
export function avatarUrl(id: string | null | undefined): string | null {
  return AVATARS.find((avatar) => avatar.id === id)?.url ?? null;
}

/** The id to start from: the person's own picture when it is one of ours, otherwise the first. */
export function avatarOrDefault(id: string | null | undefined): string {
  return avatarUrl(id) === null ? (AVATARS[0]?.id ?? '') : (id ?? '');
}
