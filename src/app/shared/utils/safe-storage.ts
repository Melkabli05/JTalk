type StorageKind = 'local' | 'session';

// Web Storage can throw (private mode, blocked site data, quota), so every
// access is wrapped and the app keeps working without persistence.
function resolve(kind: StorageKind): Storage | null {
  try {
    return kind === 'local' ? globalThis.localStorage : globalThis.sessionStorage;
  } catch {
    return null;
  }
}

export function readItem(kind: StorageKind, key: string): string | null {
  try {
    return resolve(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeItem(kind: StorageKind, key: string, value: string | null): void {
  try {
    const storage = resolve(kind);
    if (value === null) {
      storage?.removeItem(key);
    } else {
      storage?.setItem(key, value);
    }
  } catch {
    // Persistence is best-effort.
  }
}
