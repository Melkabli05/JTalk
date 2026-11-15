import { computed, type ResourceRef, type Signal } from '@angular/core';

export function loadedValue<T>(resource: ResourceRef<T | undefined>): Signal<T | undefined> {
  return computed(() => (resource.hasValue() ? resource.value() : undefined));
}
