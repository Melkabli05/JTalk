import { BreakpointObserver } from '@angular/cdk/layout';
import { computed, DOCUMENT, effect, inject, Service, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { readItem, writeItem } from '@shared/utils/safe-storage';
import { STORAGE_KEYS } from './app-config';

export type ColorSchemePreference = 'light' | 'dark' | 'system';

/** The class on <html> that turns dark mode on; app.config.ts derives Optimus' `darkModeSelector` from it. */
export const DARK_CLASS = 'app-dark';

function isPreference(value: string | null): value is ColorSchemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

@Service()
export class ColorSchemeService {
  private readonly document = inject(DOCUMENT);
  // The CDK observes the media query (and copes with browsers or test environments without matchMedia).
  private readonly systemDark = toSignal(
    inject(BreakpointObserver)
      .observe('(prefers-color-scheme: dark)')
      .pipe(map((state) => state.matches)),
    { requireSync: true },
  );

  private readonly stored = readItem('local', STORAGE_KEYS.colorScheme);
  readonly preference = signal<ColorSchemePreference>(
    isPreference(this.stored) ? this.stored : 'system',
  );
  readonly isDark = computed(() => {
    const preference = this.preference();
    return preference === 'dark' || (preference === 'system' && this.systemDark());
  });

  constructor() {
    effect(() => {
      this.document.documentElement.classList.toggle(DARK_CLASS, this.isDark());
    });
  }

  set(preference: ColorSchemePreference): void {
    this.preference.set(preference);
    writeItem('local', STORAGE_KEYS.colorScheme, preference);
  }

  toggle(): void {
    this.set(this.isDark() ? 'light' : 'dark');
  }
}
