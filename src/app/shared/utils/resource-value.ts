import { computed, type ResourceRef, type Signal } from '@angular/core';

/**
 * What a resource has loaded: its value, or `undefined` while it loads and after it failed. Reading `value()` in the error
 * state throws, so this is how a state class turns a resource into something it can compute from freely.
 */
export function loadedValue<T>(resource: ResourceRef<T | undefined>): Signal<T | undefined> {
  return computed(() => (resource.hasValue() ? resource.value() : undefined));
}
