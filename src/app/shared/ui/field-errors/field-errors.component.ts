import { Component, input } from '@angular/core';
import type { ValidationError } from '@angular/forms/signals';
import { Message } from '@openng/optimus-ui/message';
import { TranslatePipe } from '@shared/pipes/translate.pipe';

/**
 * The error messages of a field control, as Optimus `p-message`s. The element itself is always rendered
 * (give it an `id`, which the input's `aria-describedby` points to) and only fills when `visible`.
 */
@Component({
  selector: 'app-field-errors',
  imports: [TranslatePipe, Message],
  template: `
    @if (visible()) {
      @for (error of errors(); track error.message) {
        <p-message severity="error" variant="simple" size="small">{{
          error.message | t: error
        }}</p-message>
      }
    }
  `,
  styles: ':host { display: block; }',
})
export class FieldErrorsComponent {
  readonly errors = input.required<readonly ValidationError.WithOptionalFieldTree[]>();
  readonly visible = input.required<boolean>();
}
