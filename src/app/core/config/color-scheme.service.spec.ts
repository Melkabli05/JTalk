import { TestBed } from '@angular/core/testing';
import { ColorSchemeService } from './color-scheme.service';

describe('ColorSchemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('app-dark');
  });

  it('defaults to the system preference (light when unavailable)', () => {
    const scheme = TestBed.inject(ColorSchemeService);
    TestBed.tick();

    expect(scheme.preference()).toBe('system');
    expect(scheme.isDark()).toBe(false);
    expect(document.documentElement.classList.contains('app-dark')).toBe(false);
  });

  it('toggles the dark class and persists the choice', () => {
    const scheme = TestBed.inject(ColorSchemeService);

    scheme.toggle();
    TestBed.tick();
    expect(scheme.isDark()).toBe(true);
    expect(document.documentElement.classList.contains('app-dark')).toBe(true);
    expect(localStorage.getItem('jtalk:color-scheme')).toBe('dark');

    scheme.toggle();
    TestBed.tick();
    expect(document.documentElement.classList.contains('app-dark')).toBe(false);
    expect(localStorage.getItem('jtalk:color-scheme')).toBe('light');
  });

  it('restores a saved preference and ignores junk', () => {
    localStorage.setItem('jtalk:color-scheme', 'dark');
    expect(TestBed.inject(ColorSchemeService).isDark()).toBe(true);

    TestBed.resetTestingModule();
    localStorage.setItem('jtalk:color-scheme', 'purple');
    expect(TestBed.inject(ColorSchemeService).preference()).toBe('system');
  });

  it('follows the operating system while the preference is "system"', async () => {
    const mql = { matches: false, media: '', addListener: vi.fn(), removeListener: vi.fn() };
    vi.stubGlobal('matchMedia', (media: string) => ({ ...mql, media }));
    const scheme = TestBed.inject(ColorSchemeService);
    expect(scheme.isDark()).toBe(false);

    const [listener] = mql.addListener.mock.calls[0] as [(event: unknown) => void];
    mql.matches = true;
    listener({ matches: true });
    await vi.waitFor(() => expect(scheme.isDark()).toBe(true));

    scheme.set('light');
    expect(scheme.isDark()).toBe(false);
    vi.unstubAllGlobals();
  });
});
