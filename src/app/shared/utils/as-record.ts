/**
 * Narrows an untyped value (an API response) to an object whose properties can be checked one by one.
 * Returns `undefined` for anything that is not a plain object: null, arrays and primitives.
 */
export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
