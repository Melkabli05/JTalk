import { computed, inject, Service, signal } from '@angular/core';
import { asRecord } from '@shared/utils/as-record';
import { readItem, writeItem } from '@shared/utils/safe-storage';
import { STORAGE_KEYS } from '../config/app-config';
import { AuthService } from './auth.service';
import { DEV_IDENTITY } from './dev-identity.token';
import type { Person, ProfileDraft } from './identity.models';
import { tokenSubject } from './token-subject';

function storedProfile(): Person | null {
  try {
    const person = asRecord(JSON.parse(readItem('local', STORAGE_KEYS.profile) ?? 'null'));
    if (
      person === undefined ||
      typeof person['id'] !== 'string' ||
      typeof person['name'] !== 'string' ||
      typeof person['nativeLanguage'] !== 'string' ||
      typeof person['learning'] !== 'string'
    ) {
      return null;
    }
    return {
      id: person['id'],
      name: person['name'],
      nativeLanguage: person['nativeLanguage'],
      learning: person['learning'],
      avatar: typeof person['avatar'] === 'string' ? person['avatar'] : '',
    };
  } catch {
    return null;
  }
}

@Service()
export class IdentityService {
  private readonly auth = inject(AuthService);
  readonly devMode = inject(DEV_IDENTITY);

  private readonly own = signal<Person | null>(storedProfile());

  readonly profile = this.own.asReadonly();
  readonly directory = computed<ReadonlyMap<string, Person>>(() => {
    const me = this.own();
    return new Map(me ? [[me.id, me]] : []);
  });
  readonly devUserId = computed(() => (this.devMode ? (this.own()?.id ?? null) : null));
  readonly userId = computed(() => tokenSubject(this.auth.token()) ?? this.devUserId());

  readonly needsProfile = computed(
    () => this.devMode && !this.auth.isAuthenticated() && this.own() === null,
  );

  saveProfile(draft: ProfileDraft): void {
    const profile: Person = {
      id: this.own()?.id ?? crypto.randomUUID(),
      name: draft.name.trim(),
      nativeLanguage: draft.nativeLanguage,
      learning: draft.learning,
      avatar: draft.avatar,
    };
    this.own.set(profile);
    writeItem('local', STORAGE_KEYS.profile, JSON.stringify(profile));
  }
}
