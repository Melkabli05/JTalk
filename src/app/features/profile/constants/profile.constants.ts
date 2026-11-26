export type ProfileTab = 'overview' | 'edit' | 'account';

export const PROFILE_TAB_ORDER: readonly ProfileTab[] = ['overview', 'edit', 'account'];
export const PROFILE_CONNECTIONS_PAGE_SIZE = 30;

export function parseProfileTab(raw: string | null): ProfileTab | null {
  return raw === 'overview' || raw === 'edit' || raw === 'account' ? raw : null;
}
