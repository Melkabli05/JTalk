import { Component, ElementRef, input, model, viewChild } from '@angular/core';
import { InputText } from '@openng/optimus-ui/inputtext';
import { TrimOnBlurDirective } from '../../directives/trim-on-blur.directive';
import { FieldControlDirective } from '../field-control.directive';
import { FieldErrorsComponent } from '../field-errors/field-errors.component';

@Component({
  selector: 'app-text-field',
  imports: [InputText, FieldErrorsComponent, TrimOnBlurDirective],
  templateUrl: './text-field.component.html',
  styleUrl: './text-field.component.scss',
})
export class TextFieldComponent extends FieldControlDirective<string> {
  readonly type = input<'text' | 'email'>('text');
  readonly autocomplete = input<string>();

  readonly value = model('');

  private readonly control = viewChild.required<ElementRef<HTMLInputElement>>('control');

  focus(options?: FocusOptions): void {
    this.control().nativeElement.focus(options);
  }

  protected updateValue(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }
}
