import { PathKind, required, SchemaPath, SchemaPathRules, validate } from '@angular/forms/signals';

// ASCII/C1 control characters (preserving \n and \t when allowNewlines is enabled),
// invisible/zero-width/bidi-override characters, and blank Unicode filler characters.
const CONTROL_CHARS_WITHOUT_NEWLINE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const ALL_CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;
const INVISIBLE_AND_BLANK_CHARS =
  /[\u00AD\u034F\u061C\u115F\u1160\u180E\u200B\u200E-\u200F\u202A-\u202E\u2060-\u206F\u2800\u3164\uFEFF\uFFA0]/g;
const JOINERS_ONLY = /[\u200C\u200D]/g;

export function sanitizeUserText(
  value: string,
  options?: { readonly allowNewlines?: boolean },
): string {
  const normalized = value.replace(/\r\n?/g, '\n');
  const withoutControls = options?.allowNewlines
    ? normalized.replace(CONTROL_CHARS_WITHOUT_NEWLINE, '')
    : normalized.replace(ALL_CONTROL_CHARS, ' ');
  return withoutControls.replace(INVISIBLE_AND_BLANK_CHARS, '').trim();
}

export function isTrimmedNonEmpty(value: string): boolean {
  const cleaned = sanitizeUserText(value, { allowNewlines: true });
  return cleaned.replace(JOINERS_ONLY, '').trim().length > 0;
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

export function noBlankOnlyText<TPathKind extends PathKind = PathKind.Root>(
  path: SchemaPath<string, SchemaPathRules.Supported, TPathKind>,
  message: string,
  allowNewlines = false,
): void {
  validate(path, ({ value }) => {
    const current = value();
    if (current.length === 0) return undefined;
    const cleaned = sanitizeUserText(current, { allowNewlines });
    return cleaned.replace(JOINERS_ONLY, '').trim().length > 0
      ? undefined
      : { kind: 'whitespace', message };
  });
}
