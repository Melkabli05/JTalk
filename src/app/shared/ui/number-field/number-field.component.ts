import { Component, afterRenderEffect, input, model, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputNumber } from '@openng/optimus-ui/inputnumber';
import { FieldControlDirective } from '../field-control.directive';
import { FieldErrorsComponent } from '../field-errors/field-errors.component';

@Component({
  selector: 'app-number-field',
  imports: [FormsModule, InputNumber, FieldErrorsComponent],
  templateUrl: './number-field.component.html',
  styleUrl: './number-field.component.scss',
})
export class NumberFieldComponent extends FieldControlDirective<number | null> {
  readonly currency = input('USD');

  readonly value = model<number | null>(null);

  private readonly host = viewChild.required(InputNumber);

  constructor() {
    super();
    afterRenderEffect(() => {
      this.host().input.nativeElement.setAttribute('aria-invalid', String(this.showErrors()));
    });
  }

  focus(options?: FocusOptions): void {
    this.host().input.nativeElement.focus(options);
  }
}
