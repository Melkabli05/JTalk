import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Message } from '@openng/optimus-ui/message';
import { saveRequest } from '@shared/utils/save-request';
import { authFailure } from '../../auth-failure';
import { AuthService } from '../../auth.service';
import { AuthLayoutComponent } from '../../ui/auth-layout/auth-layout.component';
import { ForgotPasswordFormComponent } from '../../ui/forgot-password-form/forgot-password-form.component';
import { LocaleService } from '@core/config/locale.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { msg } from '@shared/utils/i18n/msg';

/** Container: asks for a reset link. The answer never says whether the address has an account. */
@Component({
  selector: 'app-forgot-password-page',
  imports: [
    TranslatePipe,
    AuthLayoutComponent,
    ButtonDirective,
    ForgotPasswordFormComponent,
    Message,
    RouterLink,
  ],
  templateUrl: './forgot-password-page.component.html',
})
export default class ForgotPasswordPageComponent {
  private readonly auth = inject(AuthService);
  protected readonly locales = inject(LocaleService);

  protected readonly requesting = saveRequest();
  protected readonly sent = signal(false);

  protected requestReset(email: string): void {
    this.requesting.run(this.auth.requestPasswordReset(email), {
      next: () => this.sent.set(true),
      failure: authFailure(msg('Could not send the reset link. Please try again.')),
    });
  }
}
