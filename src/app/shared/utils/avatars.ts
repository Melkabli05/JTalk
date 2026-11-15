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
