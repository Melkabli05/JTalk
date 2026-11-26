import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { COLOR_SCHEME_STORAGE_KEY } from '../../shared/constants/storage-keys.constants';
import { ThemeService } from './theme';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.removeItem(COLOR_SCHEME_STORAGE_KEY);
    document.documentElement.style.colorScheme = '';
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
  });

  it('defaults to light and toggles between light and dark with persistence', () => {
    const theme = TestBed.inject(ThemeService);
    expect(theme.colorScheme()).toBe('light');
    expect(theme.isDark()).toBe(false);

    theme.toggle();
    expect(theme.colorScheme()).toBe('dark');
    expect(theme.isDark()).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe('dark');

    theme.toggle();
    expect(theme.colorScheme()).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});
