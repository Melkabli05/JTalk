import { Component, input, output, signal } from '@angular/core';
import { FormField, FormRoot, email, form, required } from '@angular/forms/signals';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Message } from '@openng/optimus-ui/message';
import { TextFieldComponent } from '@shared/ui/text-field/text-field.component';
import { formSubmission } from '@shared/utils/form-submission';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { msg } from '@shared/utils/i18n/msg';

@Component({
  selector: 'app-forgot-password-form',
  imports: [TranslatePipe, FormField, FormRoot, ButtonDirective, Message, TextFieldComponent],
  templateUrl: './forgot-password-form.component.html',
  styleUrl: '../auth-form.scss',
})
export class ForgotPasswordFormComponent {
  readonly submitting = input(false);
  readonly error = input<string | null>(null);

  readonly requestReset = output<string>();

  private readonly model = signal({ email: '' });

  protected readonly forgotForm = form(
    this.model,
    (path) => {
      required(path.email, { message: msg('Enter your email address.') });
      email(path.email, { message: msg('Enter a valid email address.') });
    },
    {
      submission: formSubmission<{ email: string }>({
        busy: () => this.submitting(),
        submit: ({ email }) => this.requestReset.emit(email),
      }),
    },
  );
}
