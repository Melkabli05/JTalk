import { isPlatformBrowser } from '@angular/common';
import { computed, inject, PLATFORM_ID, Service, signal } from '@angular/core';
import { COLOR_SCHEME_STORAGE_KEY } from '../../shared/constants/storage-keys.constants';

export type ColorScheme = 'light' | 'dark' | 'system';

@Service()
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly scheme = signal<ColorScheme>('system');

  readonly colorScheme = this.scheme.asReadonly();

  readonly icon = computed(() => {
    switch (this.scheme()) {
      case 'light':
        return 'light_mode';
      case 'dark':
        return 'dark_mode';
      default:
        return 'contrast';
    }
  });

  readonly tooltip = computed(() => {
    switch (this.scheme()) {
      case 'light':
        return 'Theme: Light (click to switch)';
      case 'dark':
        return 'Theme: Dark (click to switch)';
      default:
        return 'Theme: System (click to switch)';
    }
  });

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const saved = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        this.setColorScheme(saved);
      }
    } catch {
      /* Storage may be unavailable. */
    }
  }

  setColorScheme(scheme: string): void {
    if (scheme !== 'light' && scheme !== 'dark' && scheme !== 'system') return;
    this.scheme.set(scheme);
    if (!isPlatformBrowser(this.platformId)) return;
    document.documentElement.style.colorScheme = scheme === 'system' ? '' : scheme;
    try {
      localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, scheme);
    } catch {
      /* Apply for this session. */
    }
  }

  cycle(): void {
    const next: ColorScheme =
      this.scheme() === 'system' ? 'light' : this.scheme() === 'light' ? 'dark' : 'system';
    this.setColorScheme(next);
  }
}
