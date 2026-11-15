import { HttpClient } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { map, Observable } from 'rxjs';
import { readItem, writeItem } from '@shared/utils/safe-storage';
import { STORAGE_KEYS } from '../config/app-config';
import { API_BASE_URL } from '../http/api-base-url.token';
import type { Credentials } from './auth.models';

// Placeholder contract (adjust to the real backend):
//   POST /auth/login           { email, password } -> { token }
//   POST /auth/register        { email, password } -> 202 (same answer for new and existing addresses)
//   POST /auth/forgot-password { email }           -> 202 (same answer for known and unknown addresses)
//   POST /auth/reset-password  { token, password } -> 204, or 400 when the token is expired or used
interface SignInResponse {
  readonly token: string;
}

/**
 * Sign-in state. The token lives in sessionStorage so it survives a reload but not a closed tab.
 * A backend-set httpOnly cookie is safer against XSS; switch to that if the API supports it.
 */
@Service()
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/auth`;
  private readonly tokenState = signal<string | null>(readItem('session', STORAGE_KEYS.token));

  readonly token = this.tokenState.asReadonly();
  readonly isAuthenticated = computed(() => this.tokenState() !== null);

  /** Emits once the session has started; fails with the HTTP error if the credentials are refused. */
  signIn(credentials: Credentials): Observable<void> {
    return this.http.post<SignInResponse>(`${this.url}/login`, credentials).pipe(
      map(({ token }) => {
        this.setToken(token);
      }),
    );
  }

  /**
   * Asks the API to create an account. The API answers the same way whether or not the address is already
   * taken (and emails the person either way), so this response cannot be used to find out who has an account.
   */
  register(credentials: Credentials): Observable<void> {
    return this.http.post<void>(`${this.url}/register`, credentials);
  }

  /** Asks for a reset link. Always succeeds from the caller's point of view, whether or not the account exists. */
  requestPasswordReset(email: string): Observable<void> {
    return this.http.post<void>(`${this.url}/forgot-password`, { email });
  }

  /** Sets a new password with the single-use token from the emailed link. Fails when the token is expired or used. */
  resetPassword(token: string, password: string): Observable<void> {
    return this.http.post<void>(`${this.url}/reset-password`, { token, password });
  }

  signOut(): void {
    this.setToken(null);
  }

  private setToken(token: string | null): void {
    this.tokenState.set(token);
    writeItem('session', STORAGE_KEYS.token, token);
  }
}
