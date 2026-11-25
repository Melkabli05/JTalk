import { ProfileFormSnapshot } from '../models/profile.model';

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '');
}

export function isValidUsername(raw: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(raw));
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
    current.speak !== saved.speak ||
    current.learn !== saved.learn ||
    current.location !== saved.location ||
    current.about !== saved.about
  );
}
