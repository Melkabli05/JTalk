import { Directive, input, type ModelSignal, output } from '@angular/core';
import type { FormValueControl, ValidationError } from '@angular/forms/signals';

let nextId = 0;

/**
 * What every labelled Signal Forms control here shares (text-field, number-field).
 *
 * `[formField]` pushes the raw `invalid` state into whatever it is bound to, which would flag untouched
 * required fields as broken. A control built on this receives `invalid`, `touched` and `errors` and shows
 * them only once the user has interacted with the field (`showErrors()`).
 */
@Directive()
export abstract class FieldControlDirective<TValue> implements FormValueControl<TValue> {
  readonly label = input.required<string>();

  /** Kept in sync with the bound field by the `FormField` directive. */
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

  /** Called by Signal Forms (`focusBoundControl()`) to focus the real input, not the host. */
  abstract focus(options?: FocusOptions): void;

  protected showErrors(): boolean {
    return this.invalid() && this.touched();
  }
}
