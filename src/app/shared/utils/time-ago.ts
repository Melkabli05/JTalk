const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long ago something happened, in the few words a chat uses: `Just now`, `5m ago`, `2h ago`, `3d ago`. Empty when the time is not a date. */
export function timeAgo(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return '';
  }
  const elapsed = Math.max(0, now - then);
  if (elapsed < MINUTE) {
    return 'Just now';
  }
  if (elapsed < HOUR) {
    return `${Math.floor(elapsed / MINUTE)}m ago`;
  }
  return elapsed < DAY ? `${Math.floor(elapsed / HOUR)}h ago` : `${Math.floor(elapsed / DAY)}d ago`;
}
