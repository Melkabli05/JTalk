import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { COLOR_SCHEME_STORAGE_KEY } from '../../shared/constants/storage-keys.constants';
import { ThemeService } from './theme';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.removeItem(COLOR_SCHEME_STORAGE_KEY);
    document.documentElement.style.colorScheme = '';
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.remove());
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to light and toggles between light and dark with persistence and theme-color sync', () => {
    const theme = TestBed.inject(ThemeService);
    expect(theme.colorScheme()).toBe('light');
    expect(theme.isDark()).toBe(false);

    theme.toggle();
    expect(theme.colorScheme()).toBe('dark');
    expect(theme.isDark()).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe('dark');
    expect(document.head.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      '#131314',
    );

    theme.toggle();
    expect(theme.colorScheme()).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.head.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      '#F8F7F4',
    );
  });

  it('follows OS prefers-color-scheme: dark when no saved preference exists', () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    try {
      const theme = TestBed.inject(ThemeService);
      expect(theme.colorScheme()).toBe('dark');
      expect(theme.isDark()).toBe(true);
      expect(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBeNull();
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
  });
});
