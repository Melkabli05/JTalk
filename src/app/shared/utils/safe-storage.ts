type StorageKind = 'local' | 'session';

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

const ignoreFailure = (): undefined => undefined;

export function writeItem(kind: StorageKind, key: string, value: string | null): void {
  try {
    const storage = resolve(kind);
    if (value === null) {
      storage?.removeItem(key);
    } else {
      storage?.setItem(key, value);
    }
  } catch {
    ignoreFailure();
  }
}
