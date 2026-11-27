export type ColorScheme = 'light' | 'dark';

export function isColorScheme(value: unknown): value is ColorScheme {
  return value === 'light' || value === 'dark';
}
