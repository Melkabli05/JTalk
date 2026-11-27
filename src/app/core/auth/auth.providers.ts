import { EnvironmentProviders, makeEnvironmentProviders, Provider } from '@angular/core';
import { AuthService, provideAuth0 } from '@auth0/auth0-angular';
import { EMPTY, from } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Browser-only Auth0 SPA provider matching JTalk's deployed Auth0 tenant.
 * Uses `cacheLocation: 'localstorage'` and refresh tokens so sessions survive
 * page reloads and LiveKit room restoration.
 */
export function provideBrowserAuth0(): EnvironmentProviders {
  const redirectUri = typeof window !== 'undefined' ? window.location.origin : '';
  return provideAuth0({
    domain: environment.auth0.domain,
    clientId: environment.auth0.clientId,
    useRefreshTokens: true,
    useRefreshTokensFallback: true,
    cacheLocation: 'localstorage',
    authorizationParams: {
      redirect_uri: redirectUri,
      audience: environment.auth0.audience,
    },
  });
}

/**
 * Safe server-side stub for Angular SSR so `AuthService` never accesses `window`
 * during initial HTML rendering of the public landing page.
 */
export function provideServerAuthStub(): Provider {
  return {
    provide: AuthService,
    useValue: {
      isLoading$: from([false]),
      isAuthenticated$: from([false]),
      user$: from([null]),
      error$: from([null]),
      idTokenClaims$: from([null]),
      getAccessTokenSilently: () => EMPTY,
      loginWithRedirect: () => EMPTY,
      logout: () => EMPTY,
    },
  };
}

export function provideNoopAuthForTests(): EnvironmentProviders {
  return makeEnvironmentProviders([provideServerAuthStub()]);
}
