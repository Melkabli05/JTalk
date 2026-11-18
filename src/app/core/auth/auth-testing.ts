import { computed, type Provider, signal } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { type Observable, of } from 'rxjs';
import type { Person } from './identity.models';
import { IdentityService } from './identity.service';

export interface FakeAuth0Options {
  readonly signedIn?: boolean;
  readonly logout?: () => Observable<void>;
  readonly loginWithRedirect?: (options?: unknown) => Observable<void>;
}

/**
 * Stands in for the Auth0 SDK in specs: signing in is a round trip to Auth0's login page, which a unit test cannot make. Everything
 * after it (the user service, the profile, the rooms) is exercised for real with HttpTestingController.
 */
export function fakeAuth0(options: FakeAuth0Options = {}): Provider {
  const {
    signedIn = true,
    logout = () => of(undefined),
    loginWithRedirect = () => of(undefined),
  } = options;
  return {
    provide: AuthService,
    useValue: { isAuthenticated$: of(signedIn), logout, loginWithRedirect },
  };
}

/**
 * Stands in for {@link IdentityService} in specs about rooms, where all that matters is who the person is: how identity is loaded is
 * covered by the identity and shell specs. {@code become} changes who is signed in; {@code resolve} sees every lookup the code under
 * test asks for.
 */
export function fakeIdentity(
  person: Person,
  resolve: (ids: Iterable<string>) => void = () => undefined,
) {
  const profile = signal<Person | null>(person);
  const provider: Provider = {
    provide: IdentityService,
    useValue: {
      signedIn: signal(true),
      profile: profile.asReadonly(),
      userId: computed(() => profile()?.id ?? null),
      needsProfile: signal(false),
      directory: computed<ReadonlyMap<string, Person>>(() => {
        const me = profile();
        return new Map(me ? [[me.id, me]] : []);
      }),
      resolve,
      saveProfile: () => of(person),
      signOut: () => Promise.resolve(),
    },
  };
  return {
    provider,
    become(next: Person): void {
      profile.set(next);
    },
  };
}
