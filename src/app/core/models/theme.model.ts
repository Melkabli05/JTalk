export type ColorScheme = 'light' | 'dark';
export type ThemePreference = 'system' | ColorScheme;

export function isColorScheme(value: unknown): value is ColorScheme {
  return value === 'light' || value === 'dark';
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || isColorScheme(value);
}
