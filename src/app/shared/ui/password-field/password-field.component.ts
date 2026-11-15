import { Component, afterRenderEffect, input, model, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Fluid } from '@openng/optimus-ui/fluid';
import { Password } from '@openng/optimus-ui/password';
import { FieldControlDirective } from '../field-control.directive';
import { FieldErrorsComponent } from '../field-errors/field-errors.component';

@Component({
  selector: 'app-password-field',
  imports: [FormsModule, Fluid, FieldErrorsComponent, Password],
  templateUrl: './password-field.component.html',
  styleUrl: './password-field.component.scss',
})
export class PasswordFieldComponent extends FieldControlDirective<string> {
  readonly autocomplete = input.required<'current-password' | 'new-password'>();
  readonly hint = input<string>();

  readonly value = model('');

  private readonly host = viewChild.required(Password);

  protected readonly hintId = `${this.inputId}-hint`;

  constructor() {
    super();
    afterRenderEffect(() => {
      const input = this.host().input.nativeElement as HTMLInputElement;
      const describedBy = [
        this.hint() ? this.hintId : null,
        this.showErrors() ? this.errorsId : null,
      ]
        .filter((id) => id !== null)
        .join(' ');
      input.setAttribute('aria-invalid', String(this.showErrors()));
      input.toggleAttribute('aria-required', this.required());
      if (describedBy) {
        input.setAttribute('aria-describedby', describedBy);
      } else {
        input.removeAttribute('aria-describedby');
      }
    });
  }

  focus(options?: FocusOptions): void {
    (this.host().input.nativeElement as HTMLInputElement).focus(options);
  }
}
