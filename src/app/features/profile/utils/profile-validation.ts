import { ProfileFormSnapshot } from '../models/profile.model';

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '');
}

export function isValidUsername(raw: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(raw));
}

export function generateUsernameFor(displayName: string): string {
  const base = displayName
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 18);
  const suffix = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
  const candidate = `${base || 'speaker'}_${suffix}`;
  return candidate.length >= 3 ? candidate.slice(0, 30) : `speaker_${suffix}`;
}

export function isProfileDirty(
  current: ProfileFormSnapshot,
  saved: ProfileFormSnapshot,
): boolean {
  return (
    current.name !== saved.name ||
    normalizeUsername(current.username) !== normalizeUsername(saved.username) ||
    current.avatar.kind !== saved.avatar.kind ||
    current.avatar.id !== saved.avatar.id ||
    (current.avatar.imageUrl ?? null) !== (saved.avatar.imageUrl ?? null) ||
    current.speak !== saved.speak ||
    current.learn !== saved.learn ||
    current.location !== saved.location ||
    current.about !== saved.about
  );
}
