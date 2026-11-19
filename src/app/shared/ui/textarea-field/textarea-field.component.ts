import { Component, ElementRef, input, model, viewChild } from '@angular/core';
import { Textarea } from '@openng/optimus-ui/textarea';
import { FieldControlDirective } from '../field-control.directive';
import { FieldErrorsComponent } from '../field-errors/field-errors.component';

@Component({
  selector: 'app-textarea-field',
  imports: [FieldErrorsComponent, Textarea],
  templateUrl: './textarea-field.component.html',
  styleUrl: './textarea-field.component.scss',
  host: { '[class.pill]': 'pill()' },
})
export class TextareaFieldComponent extends FieldControlDirective<string> {
  readonly rows = input(3);
  readonly labelHidden = input(false);
  readonly pill = input(false);
  readonly placeholder = input('');
  readonly maxLength = input<number>();

  readonly value = model('');

  private readonly control = viewChild.required<ElementRef<HTMLTextAreaElement>>('control');

  focus(options?: FocusOptions): void {
    this.control().nativeElement.focus(options);
  }

  protected updateValue(event: Event): void {
    this.value.set((event.target as HTMLTextAreaElement).value);
  }
}
