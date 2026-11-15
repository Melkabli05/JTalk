import { Component, input } from '@angular/core';
import type { ValidationError } from '@angular/forms/signals';
import { Message } from '@openng/optimus-ui/message';
import { TranslatePipe } from '@shared/pipes/translate.pipe';

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
