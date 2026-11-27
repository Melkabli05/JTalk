import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID, Service, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';

@Service()
export class SessionExpiryHandler {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService, { optional: true });

  private handling = false;
  private readonly expiredState = signal(false);
  readonly sessionExpired = this.expiredState.asReadonly();

  handle(): void {
    if (!isPlatformBrowser(this.platformId) || this.handling) return;
    this.handling = true;
    this.expiredState.set(true);

    const finish = () => {
      const done = () => {
        this.handling = false;
      };
      if (this.router.url === '/') {
        done();
        return;
      }
      void this.router.navigate(['/'], { replaceUrl: true }).finally(done);
    };

    if (!this.auth) {
      finish();
      return;
    }

    this.auth.logout({ openUrl: false }).subscribe({
      next: finish,
      error: finish,
    });
  }

  clear(): void {
    this.expiredState.set(false);
  }
}