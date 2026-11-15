import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { resource } from '@angular/core';
import { loadedValue } from './resource-value';

describe('loadedValue', () => {
  it('is undefined while loading, the value once loaded, and undefined again after a failure', async () => {
    const fail = signal(false);
    const source = TestBed.runInInjectionContext(() =>
      resource({
        params: () => fail(),
        loader: ({ params }) => (params ? Promise.reject(new Error('no')) : Promise.resolve(42)),
      }),
    );
    const value = TestBed.runInInjectionContext(() => loadedValue(source));

    expect(value()).toBeUndefined();

    TestBed.tick();
    await new Promise((r) => setTimeout(r));
    TestBed.tick();
    expect(value()).toBe(42);

    fail.set(true);
    TestBed.tick();
    await new Promise((r) => setTimeout(r));
    TestBed.tick();
    expect(source.error()).toBeDefined();
    expect(value()).toBeUndefined();
  });
});
