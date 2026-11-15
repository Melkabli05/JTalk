import { Component, input, output, signal } from '@angular/core';
import { FormField, FormRoot, email, form, minLength, required } from '@angular/forms/signals';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Message } from '@openng/optimus-ui/message';
import { PasswordFieldComponent } from '@shared/ui/password-field/password-field.component';
import { TextFieldComponent } from '@shared/ui/text-field/text-field.component';
import { formSubmission } from '@shared/utils/form-submission';
import { type Credentials, MIN_PASSWORD_LENGTH } from '../../auth.models';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { msg } from '@shared/utils/i18n/msg';

@Component({
  selector: 'app-register-form',
  imports: [
    TranslatePipe,
    FormField,
    FormRoot,
    ButtonDirective,
    Message,
    PasswordFieldComponent,
    TextFieldComponent,
  ],
  templateUrl: './register-form.component.html',
  styleUrl: '../auth-form.scss',
})
export class RegisterFormComponent {
  readonly submitting = input(false);
  readonly error = input<string | null>(null);

  readonly register = output<Credentials>();

  protected readonly minLength = MIN_PASSWORD_LENGTH;

  private readonly model = signal<Credentials>({ email: '', password: '' });

  protected readonly registerForm = form(
    this.model,
    (path) => {
      required(path.email, { message: msg('Enter your email address.') });
      email(path.email, { message: msg('Enter a valid email address.') });
      required(path.password, { message: msg('Choose a password.') });
      minLength(path.password, MIN_PASSWORD_LENGTH, {
        message: msg('Use at least {minLength} characters.'),
      });
    },
    {
      submission: formSubmission<Credentials>({
        busy: () => this.submitting(),
        submit: (credentials) => this.register.emit(credentials),
      }),
    },
  );
}
