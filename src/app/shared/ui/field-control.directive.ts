import { Directive, input, type ModelSignal, output } from '@angular/core';
import type { FormValueControl, ValidationError } from '@angular/forms/signals';

let nextId = 0;

@Directive()
export abstract class FieldControlDirective<TValue> implements FormValueControl<TValue> {
  readonly label = input.required<string>();

  abstract readonly value: ModelSignal<TValue>;
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  readonly invalid = input(false);
  readonly touched = input(false);
  readonly disabled = input(false);
  readonly required = input(false);
  readonly touch = output();

  private readonly id = nextId++;
  protected readonly inputId = `app-field-${this.id}`;
  protected readonly errorsId = `app-field-${this.id}-errors`;

  abstract focus(options?: FocusOptions): void;

  protected showErrors(): boolean {
    return this.invalid() && this.touched();
  }
}
