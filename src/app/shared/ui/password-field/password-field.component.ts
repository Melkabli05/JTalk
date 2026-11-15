import { Component, afterRenderEffect, input, model, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Fluid } from '@openng/optimus-ui/fluid';
import { Password } from '@openng/optimus-ui/password';
import { FieldControlDirective } from '../field-control.directive';
import { FieldErrorsComponent } from '../field-errors/field-errors.component';

/**
 * Labelled password input for Signal Forms: `<app-password-field label="Password" autocomplete="new-password" [formField]="f.password" />`.
 * Show/hide is the Optimus `p-password` toggle. There is no strength meter on purpose: it would nudge
 * people toward composition rules (symbols, capitals), which NIST and OWASP advise against; length is
 * the rule, shown as a `hint`. The value is never trimmed, and pasting is allowed (password managers).
 */
@Component({
  selector: 'app-password-field',
  imports: [FormsModule, Fluid, FieldErrorsComponent, Password],
  templateUrl: './password-field.component.html',
  styleUrl: './password-field.component.scss',
})
export class PasswordFieldComponent extends FieldControlDirective<string> {
  /** `current-password` to sign in, `new-password` when choosing one (the browser then offers to generate it). */
  readonly autocomplete = input.required<'current-password' | 'new-password'>();
  /** Help shown under the field and linked to it with `aria-describedby`. */
  readonly hint = input<string>();

  readonly value = model('');

  private readonly host = viewChild.required(Password);

  protected readonly hintId = `${this.inputId}-hint`;

  constructor() {
    super();
    // p-password does not expose these on its inner input, so set them there.
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
