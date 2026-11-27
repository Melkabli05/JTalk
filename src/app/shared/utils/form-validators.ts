import { PathKind, required, SchemaPath, SchemaPathRules, validate } from '@angular/forms/signals';

export function isTrimmedNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function trimmedRequired<TPathKind extends PathKind = PathKind.Root>(
  path: SchemaPath<string, SchemaPathRules.Supported, TPathKind>,
  message: string,
): void {
  required(path, { message });
  validate(path, ({ value }) => {
    const current = value();
    return current.length === 0 || isTrimmedNonEmpty(current)
      ? undefined
      : { kind: 'whitespace', message };
  });
}
