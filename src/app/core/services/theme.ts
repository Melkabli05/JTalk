import { isPlatformBrowser } from '@angular/common';
import { computed, inject, PLATFORM_ID, Service, signal } from '@angular/core';
import { COLOR_SCHEME_STORAGE_KEY } from '../../shared/constants/storage-keys.constants';

export type ColorScheme = 'light' | 'dark';

@Service()
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly scheme = signal<ColorScheme>('light');

  readonly colorScheme = this.scheme.asReadonly();
  readonly isDark = computed(() => this.scheme() === 'dark');

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const saved = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') {
        this.setColorScheme(saved);
      }
    } catch {
      /* Storage may be unavailable. */
    }
  }

  setColorScheme(scheme: string): void {
    if (scheme !== 'light' && scheme !== 'dark') return;
    this.scheme.set(scheme);
    if (!isPlatformBrowser(this.platformId)) return;
    document.documentElement.style.colorScheme = scheme;
    try {
      localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, scheme);
    } catch {
      /* Apply for this session. */
    }
  }

  toggle(): void {
    this.setColorScheme(this.scheme() === 'dark' ? 'light' : 'dark');
  }
}
