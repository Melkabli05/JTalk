import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID, Service } from '@angular/core';

export type StorageArea = 'local' | 'session';

@Service()
export class BrowserStorage {
  private readonly platformId = inject(PLATFORM_ID);

  getString(area: StorageArea, key: string): string | null {
    const store = this.resolveStore(area);
    if (!store) return null;
    try {
      return store.getItem(key);
    } catch {
      return null;
    }
  }

  setString(area: StorageArea, key: string, value: string): void {
    const store = this.resolveStore(area);
    if (!store) return;
    try {
      store.setItem(key, value);
    } catch {
      /* Ignore storage quota or privacy-mode failures. */
    }
  }

  getJson<T>(
    area: StorageArea,
    key: string,
    guard: (value: unknown) => value is T,
    fallback: T,
  ): T {
    const raw = this.getString(area, key);
    if (raw === null) return fallback;
    try {
      const parsed: unknown = JSON.parse(raw);
      return guard(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  setJson(area: StorageArea, key: string, value: unknown): void {
    try {
      this.setString(area, key, JSON.stringify(value));
    } catch {
      /* Ignore non-serializable values. */
    }
  }

  remove(area: StorageArea, key: string): void {
    const store = this.resolveStore(area);
    if (!store) return;
    try {
      store.removeItem(key);
    } catch {
      /* Ignore storage failures. */
    }
  }

  private resolveStore(area: StorageArea): Storage | null {
    if (!isPlatformBrowser(this.platformId) || typeof window === 'undefined') {
      return null;
    }
    try {
      return area === 'local' ? window.localStorage : window.sessionStorage;
    } catch {
      return null;
    }
  }
}
