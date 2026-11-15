import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Message } from '@openng/optimus-ui/message';
import { saveRequest } from '@shared/utils/save-request';
import { authFailure } from '../../auth-failure';
import type { Credentials } from '../../auth.models';
import { AuthService } from '../../auth.service';
import { AuthLayoutComponent } from '../../ui/auth-layout/auth-layout.component';
import { RegisterFormComponent } from '../../ui/register-form/register-form.component';
import { LocaleService } from '@core/config/locale.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { msg } from '@shared/utils/i18n/msg';

/**
 * Container: creates the account. The confirmation is the same whether or not the address was already
 * registered, so the page cannot be used to find out who has an account (OWASP account enumeration).
 */
@Component({
  selector: 'app-register-page',
  imports: [
    TranslatePipe,
    AuthLayoutComponent,
    ButtonDirective,
    Message,
    RegisterFormComponent,
    RouterLink,
  ],
  templateUrl: './register-page.component.html',
})
export default class RegisterPageComponent {
  private readonly auth = inject(AuthService);
  protected readonly locales = inject(LocaleService);

  protected readonly registering = saveRequest();
  protected readonly sent = signal(false);

  protected register(credentials: Credentials): void {
    this.registering.run(this.auth.register(credentials), {
      next: () => this.sent.set(true),
      failure: authFailure(msg('Could not create your account. Please try again.')),
    });
  }
}
