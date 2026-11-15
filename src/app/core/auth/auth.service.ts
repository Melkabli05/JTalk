import { HttpClient } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { map, Observable } from 'rxjs';
import { readItem, writeItem } from '@shared/utils/safe-storage';
import { STORAGE_KEYS } from '../config/app-config';
import { API_BASE_URL } from '../http/api-base-url.token';
import type { Credentials } from './auth.models';

interface SignInResponse {
  readonly token: string;
}

@Service()
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/auth`;
  private readonly tokenState = signal<string | null>(readItem('session', STORAGE_KEYS.token));

  readonly token = this.tokenState.asReadonly();
  readonly isAuthenticated = computed(() => this.tokenState() !== null);

  signIn(credentials: Credentials): Observable<void> {
    return this.http.post<SignInResponse>(`${this.url}/login`, credentials).pipe(
      map(({ token }) => {
        this.setToken(token);
      }),
    );
  }

  register(credentials: Credentials): Observable<void> {
    return this.http.post<void>(`${this.url}/register`, credentials);
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.http.post<void>(`${this.url}/forgot-password`, { email });
  }

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
