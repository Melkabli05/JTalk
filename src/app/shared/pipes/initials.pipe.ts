import { Pipe, PipeTransform } from '@angular/core';

/** `"Ada Lovelace"` -> `"AL"`. Up to two letters, upper-cased; empty input gives an empty string. */
@Pipe({ name: 'initials' })
export class InitialsPipe implements PipeTransform {
  transform(name: string | null | undefined): string {
    const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
    const first = words.at(0);
    const last = words.length > 1 ? words.at(-1) : undefined;
    return [first, last]
      .map((word) => word?.charAt(0) ?? '')
      .join('')
      .toUpperCase();
  }
}
