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

  it('defaults to system and updates DOM + localStorage on setColorScheme', () => {
    const theme = TestBed.inject(ThemeService);
    expect(theme.colorScheme()).toBe('system');

    theme.setColorScheme('dark');
    expect(theme.colorScheme()).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe('dark');

    theme.cycle();
    expect(theme.colorScheme()).toBe('system');
    expect(document.documentElement.style.colorScheme).toBe('');
  });
});
