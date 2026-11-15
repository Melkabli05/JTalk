import { Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { saveRequest } from '@shared/utils/save-request';
import { AuthService } from '../../auth.service';
import { authFailure } from '../../auth-failure';
import type { Credentials } from '../../auth.models';
import { AuthLayoutComponent } from '../../ui/auth-layout/auth-layout.component';
import { LoginFormComponent } from '../../ui/login-form/login-form.component';
import { LocaleService } from '@core/config/locale.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { msg } from '@shared/utils/i18n/msg';

/** Only in-app paths: `//evil.example` and `https://evil.example` must not become a redirect target. */
function safeReturnUrl(url: string | undefined): string {
  return url?.startsWith('/') && !url.startsWith('//') && !url.includes('\\') ? url : '/';
}

/** Container: signs in with the form's credentials, then goes where the user was headed (`?returnUrl=`). */
@Component({
  selector: 'app-login-page',
  imports: [TranslatePipe, AuthLayoutComponent, ButtonDirective, LoginFormComponent, RouterLink],
  templateUrl: './login-page.component.html',
})
export default class LoginPageComponent {
  private readonly auth = inject(AuthService);
  protected readonly locales = inject(LocaleService);
  private readonly router = inject(Router);

  /** The `returnUrl` query parameter (bound by `withComponentInputBinding()`). */
  readonly returnUrl = input<string>();

  protected readonly signingIn = saveRequest();

  protected signIn(credentials: Credentials): void {
    this.signingIn.run(this.auth.signIn(credentials), {
      next: () =>
        void this.router.navigateByUrl(safeReturnUrl(this.returnUrl()), { replaceUrl: true }),
      failure: authFailure(msg('Could not sign in. Please try again.'), {
        401: msg('Incorrect email or password.'),
      }),
    });
  }
}
