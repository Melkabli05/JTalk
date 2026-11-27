import type { UserSummaryResponse } from '../../core/auth/auth.models';

export interface ProfileSummaryLike {
  readonly id: string;
  readonly username?: string | null;
  readonly displayName?: string | null;
  readonly avatarUrl?: string | null;
}

/**
 * Overlays cached directory fields onto {@code item} while preserving reference equality when unchanged.
 */
export function overlayUserSummary<T extends ProfileSummaryLike>(
  item: T,
  directory: ReadonlyMap<string, UserSummaryResponse>,
): T {
  const cached = directory.get(item.id);
  if (
    !cached ||
    (cached.avatarUrl === item.avatarUrl &&
      cached.displayName === item.displayName &&
      cached.username === item.username)
  ) {
    return item;
  }
  return {
    ...item,
    avatarUrl: cached.avatarUrl,
    displayName: cached.displayName,
    username: cached.username,
  };
}

/**
 * Overlays cached directory fields onto a list, returning the original array reference if every item is unchanged.
 */
export function overlayUserSummaryList<T extends ProfileSummaryLike>(
  list: readonly T[] | null | undefined,
  directory: ReadonlyMap<string, UserSummaryResponse>,
): readonly T[] | null | undefined {
  if (!list || list.length === 0) return list;
  let changed = false;
  const next = list.map((item) => {
    const updated = overlayUserSummary(item, directory);
    if (updated !== item) changed = true;
    return updated;
  });
  return changed ? next : list;
}
