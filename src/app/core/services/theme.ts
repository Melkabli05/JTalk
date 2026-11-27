import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, DestroyRef, inject, PLATFORM_ID, Service, signal } from '@angular/core';
import { COLOR_SCHEME_STORAGE_KEY } from '../../shared/constants/storage-keys.constants';
import {
  type ColorScheme,
  isColorScheme,
  type ThemePreference,
} from '../models/theme.model';
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

  private readonly preferenceState = signal<ThemePreference>('system');
  private readonly systemScheme = signal<ColorScheme>('light');

  readonly preference = this.preferenceState.asReadonly();
  readonly colorScheme = computed<ColorScheme>(() => {
    const pref = this.preferenceState();
    return pref === 'system' ? this.systemScheme() : pref;
  });
  readonly isDark = computed(() => this.colorScheme() === 'dark');

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    const mediaQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    this.systemScheme.set(mediaQuery?.matches ? 'dark' : 'light');

    if (mediaQuery) {
      const onSystemChange = (event: MediaQueryListEvent): void => {
        const next: ColorScheme = event.matches ? 'dark' : 'light';
        this.systemScheme.set(next);
        if (this.preferenceState() === 'system') {
          this.syncThemeColorMeta(next, false);
        }
      };
      mediaQuery.addEventListener('change', onSystemChange);
      this.destroyRef.onDestroy(() => mediaQuery.removeEventListener('change', onSystemChange));
    }

    const saved = this.storage.getString('local', COLOR_SCHEME_STORAGE_KEY);
    if (isColorScheme(saved)) {
      this.setPreference(saved);
      return;
    }

    this.preferenceState.set('system');
    this.document.documentElement.style.colorScheme = '';
    this.syncThemeColorMeta(this.systemScheme(), false);
  }

  setPreference(preference: ThemePreference): void {
    this.preferenceState.set(preference);
    if (!isPlatformBrowser(this.platformId)) return;

    if (preference === 'system') {
      this.document.documentElement.style.colorScheme = '';
      this.storage.remove('local', COLOR_SCHEME_STORAGE_KEY);
      this.syncThemeColorMeta(this.systemScheme(), false);
      return;
    }

    this.document.documentElement.style.colorScheme = preference;
    this.syncThemeColorMeta(preference, true);
    this.storage.setString('local', COLOR_SCHEME_STORAGE_KEY, preference);
  }

  setColorScheme(scheme: ColorScheme): void {
    this.setPreference(scheme);
  }

  toggle(): void {
    this.setPreference(this.colorScheme() === 'dark' ? 'light' : 'dark');
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
