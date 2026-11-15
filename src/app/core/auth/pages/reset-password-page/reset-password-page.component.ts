import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Message } from '@openng/optimus-ui/message';
import { saveRequest } from '@shared/utils/save-request';
import { authFailure } from '../../auth-failure';
import { AuthService } from '../../auth.service';
import { AuthLayoutComponent } from '../../ui/auth-layout/auth-layout.component';
import { ResetPasswordFormComponent } from '../../ui/reset-password-form/reset-password-form.component';
import { LocaleService } from '@core/config/locale.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { msg } from '@shared/utils/i18n/msg';

const LINK_SPENT = msg('This link has expired or was already used. Request a new one.');

@Component({
  selector: 'app-reset-password-page',
  imports: [
    TranslatePipe,
    AuthLayoutComponent,
    ButtonDirective,
    Message,
    ResetPasswordFormComponent,
    RouterLink,
  ],
  templateUrl: './reset-password-page.component.html',
})
export default class ResetPasswordPageComponent {
  private readonly auth = inject(AuthService);
  protected readonly locales = inject(LocaleService);

  readonly token = input<string>();

  protected readonly resetting = saveRequest();
  protected readonly done = signal(false);

  protected resetPassword(password: string): void {
    const token = this.token();
    if (!token) {
      return;
    }
    this.resetting.run(this.auth.resetPassword(token, password), {
      next: () => this.done.set(true),
      failure: authFailure(msg('Could not change your password. Please try again.'), {
        400: LINK_SPENT,
        410: LINK_SPENT,
      }),
    });
  }
}
