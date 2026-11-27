import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, DestroyRef, inject, PLATFORM_ID, Service, signal } from '@angular/core';
import { COLOR_SCHEME_STORAGE_KEY } from '../../shared/constants/storage-keys.constants';
import { type ColorScheme, isColorScheme } from '../models/theme.model';
import { BrowserStorage } from './browser-storage';

// Matches --mat-sys-background: light-dark(#F8F7F4, #131314) in src/styles/_theme.scss
const THEME_COLOR_BY_SCHEME = {
  light: '#F8F7F4',
  dark: '#131314',
} as const satisfies Record<ColorScheme, string>;

@Service()
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly storage = inject(BrowserStorage);
  private readonly scheme = signal<ColorScheme>('light');
  private hasExplicitPreference = false;

  readonly colorScheme = this.scheme.asReadonly();
  readonly isDark = computed(() => this.scheme() === 'dark');

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    const saved = this.storage.getString('local', COLOR_SCHEME_STORAGE_KEY);
    if (isColorScheme(saved)) {
      this.setColorScheme(saved);
      return;
    }

    const mediaQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    const resolved: ColorScheme = mediaQuery?.matches ? 'dark' : 'light';
    this.scheme.set(resolved);
    this.syncThemeColorMeta(resolved, false);

    if (mediaQuery) {
      const onSystemChange = (event: MediaQueryListEvent): void => {
        if (this.hasExplicitPreference) return;
        const next: ColorScheme = event.matches ? 'dark' : 'light';
        this.scheme.set(next);
        this.syncThemeColorMeta(next, false);
      };
      mediaQuery.addEventListener('change', onSystemChange);
      this.destroyRef.onDestroy(() => mediaQuery.removeEventListener('change', onSystemChange));
    }
  }

  setColorScheme(scheme: ColorScheme): void {
    this.hasExplicitPreference = true;
    this.scheme.set(scheme);
    if (!isPlatformBrowser(this.platformId)) return;
    this.document.documentElement.style.colorScheme = scheme;
    this.syncThemeColorMeta(scheme, true);
    this.storage.setString('local', COLOR_SCHEME_STORAGE_KEY, scheme);
  }

  toggle(): void {
    this.setColorScheme(this.scheme() === 'dark' ? 'light' : 'dark');
  }

  private syncThemeColorMeta(scheme: ColorScheme, explicit: boolean): void {
    const color = THEME_COLOR_BY_SCHEME[scheme];
    const head = this.document.head;
    if (!head) return;

    if (explicit) {
      const metas = Array.from(head.querySelectorAll('meta[name="theme-color"]'));
      const [primary, ...extras] = metas;
      if (!primary) {
        const meta = this.document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = color;
        head.appendChild(meta);
        return;
      }
      primary.removeAttribute('media');
      primary.setAttribute('content', color);
      for (const extra of extras) {
        extra.remove();
      }
      return;
    }

    const singleMeta = head.querySelector('meta[name="theme-color"]:not([media])');
    if (singleMeta) {
      singleMeta.setAttribute('content', color);
    }
  }
}
