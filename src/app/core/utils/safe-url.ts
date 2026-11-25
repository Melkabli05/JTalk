/**
 * Validates that an avatar URL matches the User Service contract:
 * either an `https://` URL or a single-slash relative path without `..` or `//`.
 */
export function isSafeAvatarUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 500) return false;
  if (trimmed.startsWith('/')) {
    return !trimmed.startsWith('//') && !trimmed.includes('..');
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function sanitizeAvatarUrl(url: string | null | undefined): string | null {
  return isSafeAvatarUrl(url) ? url.trim() : null;
}
