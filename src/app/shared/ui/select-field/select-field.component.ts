import { Component, computed, input, model, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Select } from '@openng/optimus-ui/select';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { FieldControlDirective } from '../field-control.directive';
import { FieldErrorsComponent } from '../field-errors/field-errors.component';

export interface SelectOption<TValue> {
  readonly value: TValue;
  readonly label: string;
  readonly prefix?: string;
}

@Component({
  selector: 'app-select-field',
  imports: [FormsModule, Select, FieldErrorsComponent, TranslatePipe],
  templateUrl: './select-field.component.html',
  styleUrl: './select-field.component.scss',
})
export class SelectFieldComponent<
  TValue extends string | number,
> extends FieldControlDirective<TValue | null> {
  readonly options = input.required<readonly SelectOption<TValue>[]>();

  readonly value = model<TValue | null>(null);

  private readonly control = viewChild.required(Select);

  protected readonly choices = computed(() => [...this.options()]);

  protected readonly selected = computed(() =>
    this.options().find((option) => option.value === this.value()),
  );

  focus(): void {
    this.control().focus();
  }
}
