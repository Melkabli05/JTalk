import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserStorage } from './browser-storage';

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

describe('BrowserStorage', () => {
  const key = 'jtalk_browser_storage_test';

  beforeEach(() => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
  });

  afterEach(() => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });

  it('stores, reads, and removes strings in local and session storage', () => {
    const storage = TestBed.inject(BrowserStorage);
    expect(storage.getString('local', key)).toBeNull();

    storage.setString('local', key, 'dark');
    expect(storage.getString('local', key)).toBe('dark');
    storage.remove('local', key);
    expect(storage.getString('local', key)).toBeNull();

    storage.setString('session', key, 'room-1');
    expect(storage.getString('session', key)).toBe('room-1');
    storage.remove('session', key);
    expect(storage.getString('session', key)).toBeNull();
  });

  it('parses JSON values safely with a type guard and falls back on invalid data', () => {
    const storage = TestBed.inject(BrowserStorage);

    storage.setJson('session', key, true);
    expect(storage.getJson('session', key, isBoolean, false)).toBe(true);

    storage.setString('session', key, '"not-a-boolean"');
    expect(storage.getJson('session', key, isBoolean, false)).toBe(false);

    storage.setString('session', key, '{malformed');
    expect(storage.getJson('session', key, isBoolean, true)).toBe(true);
  });

  it('returns null and fallbacks cleanly during SSR', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: PLATFORM_ID, useValue: 'server' }],
    });
    const storage = TestBed.inject(BrowserStorage);
    storage.setString('local', key, 'dark');
    expect(storage.getString('local', key)).toBeNull();
    expect(storage.getJson('local', key, isBoolean, true)).toBe(true);
  });
});
