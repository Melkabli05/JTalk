import { Component, input, output, signal } from '@angular/core';
import { FormField, FormRoot, form, minLength, required } from '@angular/forms/signals';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Message } from '@openng/optimus-ui/message';
import { PasswordFieldComponent } from '@shared/ui/password-field/password-field.component';
import { formSubmission } from '@shared/utils/form-submission';
import { MIN_PASSWORD_LENGTH } from '../../auth.models';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { msg } from '@shared/utils/i18n/msg';

@Component({
  selector: 'app-reset-password-form',
  imports: [TranslatePipe, FormField, FormRoot, ButtonDirective, Message, PasswordFieldComponent],
  templateUrl: './reset-password-form.component.html',
  styleUrl: '../auth-form.scss',
})
export class ResetPasswordFormComponent {
  readonly submitting = input(false);
  readonly error = input<string | null>(null);

  readonly resetPassword = output<string>();

  protected readonly minLength = MIN_PASSWORD_LENGTH;

  private readonly model = signal({ password: '' });

  protected readonly resetForm = form(
    this.model,
    (path) => {
      required(path.password, { message: msg('Choose a new password.') });
      minLength(path.password, MIN_PASSWORD_LENGTH, {
        message: msg('Use at least {minLength} characters.'),
      });
    },
    {
      submission: formSubmission<{ password: string }>({
        busy: () => this.submitting(),
        submit: ({ password }) => this.resetPassword.emit(password),
      }),
    },
  );
}
