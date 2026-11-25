import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { isTrimmedNonEmpty, trimmedRequired } from './form-validators';

describe('form-validators', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
  });

  it('should evaluate trimmed non-empty strings', () => {
    expect(isTrimmedNonEmpty('')).toBe(false);
    expect(isTrimmedNonEmpty('   ')).toBe(false);
    expect(isTrimmedNonEmpty('Practice room')).toBe(true);
    expect(isTrimmedNonEmpty('  Café  ')).toBe(true);
  });

  it('should mark Signal Forms field invalid for empty or whitespace-only values', () => {
    TestBed.runInInjectionContext(() => {
      const model = signal('');
      const field = form(model, (path) => {
        trimmedRequired(path, 'Room title is required.');
      });

      expect(field().invalid()).toBe(true);
      expect(field().required()).toBe(true);

      model.set('   ');
      expect(field().invalid()).toBe(true);

      model.set('  Café  ');
      expect(field().invalid()).toBe(false);
    });
  });
});
