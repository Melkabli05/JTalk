import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import {
  isTrimmedNonEmpty,
  noBlankOnlyText,
  sanitizeUserText,
  trimmedRequired,
} from './form-validators';

describe('form-validators', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
  });

  it('should evaluate trimmed non-empty strings and reject invisible/control-only text', () => {
    expect(isTrimmedNonEmpty('')).toBe(false);
    expect(isTrimmedNonEmpty('   ')).toBe(false);
    expect(isTrimmedNonEmpty('\u200B\u200C\uFEFF')).toBe(false);
    expect(isTrimmedNonEmpty('\u2800\u3164')).toBe(false);
    expect(isTrimmedNonEmpty('\u0000\u0007\u202E')).toBe(false);
    expect(isTrimmedNonEmpty('Practice room')).toBe(true);
    expect(isTrimmedNonEmpty('  Café  ')).toBe(true);
    expect(sanitizeUserText(' \u202EHello\u200B\nWorld\u0007 ')).toBe('Hello World');
    expect(sanitizeUserText(' Line 1\r\nLine 2\u200B ', { allowNewlines: true })).toBe(
      'Line 1\nLine 2',
    );
  });

  it('should mark optional fields invalid when filled only with invisible or blank Unicode chars', () => {
    TestBed.runInInjectionContext(() => {
      const model = signal('');
      const field = form(model, (path) => {
        noBlankOnlyText(path, 'Enter valid text or leave blank.');
      });

      expect(field().invalid()).toBe(false);
      model.set('\u2800\u200B');
      expect(field().invalid()).toBe(true);
      expect(field().errors()[0]?.kind).toBe('whitespace');

      model.set('Valid topic');
      expect(field().invalid()).toBe(false);
    });
  });

  it('should mark Signal Forms field invalid for empty or whitespace-only values', () => {
    TestBed.runInInjectionContext(() => {
      const model = signal('');
      const field = form(model, (path) => {
        trimmedRequired(path, 'Room title is required.');
      });

      expect(field().invalid()).toBe(true);
      expect(field().required()).toBe(true);
      expect(field().errors()).toHaveLength(1);
      expect(field().errors()[0]?.kind).toBe('required');

      model.set('   ');
      expect(field().invalid()).toBe(true);
      expect(field().errors()).toHaveLength(1);
      expect(field().errors()[0]?.kind).toBe('whitespace');

      model.set('  Café  ');
      expect(field().invalid()).toBe(false);
      expect(field().errors()).toHaveLength(0);
    });
  });
});
