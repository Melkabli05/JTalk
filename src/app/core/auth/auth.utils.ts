import { ApiError } from '../http/http-error.interceptor';

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Validates that a post-login redirect target stays strictly on an internal
 * app route (preventing open redirects and home-route loops).
 */
export function sanitizeReturnUrl(
  raw: string | null | undefined,
  fallback = '/rooms',
): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return fallback;
  }
  if (trimmed.includes('\\') || hasControlChar(trimmed)) {
    return fallback;
  }
  const pathname = (trimmed.split(/[?#]/)[0] ?? '').replace(/\/+$/, '');
  if (!pathname) {
    return fallback;
  }
  return trimmed;
}

/**
 * Returns true for transient network / proxy / cold-start failures on
 * `GET /api/v1/users/me` that are safe to retry automatically while online.
 * Never retries 4xx client errors (401/403/404) or offline states.
 */
export function isTransientProfileError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  if (error.type === 'urn:jtalk:proxy:problem:upstream-unavailable') return true;
  return (
    error.status === 0 ||
    error.status === 408 ||
    error.status === 502 ||
    error.status === 503 ||
    error.status === 504
  );
}
