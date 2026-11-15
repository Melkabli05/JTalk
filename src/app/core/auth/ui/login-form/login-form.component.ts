import { Component, input, output, signal } from '@angular/core';
import { FormField, FormRoot, email, form, required } from '@angular/forms/signals';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Message } from '@openng/optimus-ui/message';
import { PasswordFieldComponent } from '@shared/ui/password-field/password-field.component';
import { TextFieldComponent } from '@shared/ui/text-field/text-field.component';
import { formSubmission } from '@shared/utils/form-submission';
import type { Credentials } from '../../auth.models';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { msg } from '@shared/utils/i18n/msg';

/** Presentational sign-in form: emits valid credentials, never calls the API. */
@Component({
  selector: 'app-login-form',
  imports: [
    TranslatePipe,
    FormField,
    FormRoot,
    ButtonDirective,
    Message,
    PasswordFieldComponent,
    TextFieldComponent,
  ],
  templateUrl: './login-form.component.html',
  styleUrl: '../auth-form.scss',
})
export class LoginFormComponent {
  readonly submitting = input(false);
  readonly error = input<string | null>(null);

  readonly signIn = output<Credentials>();

  private readonly model = signal<Credentials>({ email: '', password: '' });

  protected readonly loginForm = form(
    this.model,
    (path) => {
      required(path.email, { message: msg('Enter your email address.') });
      email(path.email, { message: msg('Enter a valid email address.') });
      required(path.password, { message: msg('Enter your password.') });
    },
    {
      submission: formSubmission<Credentials>({
        busy: () => this.submitting(),
        submit: (credentials) => this.signIn.emit(credentials),
      }),
    },
  );
}
