import { Directive, ElementRef, inject } from '@angular/core';

/**
 * Trims leading and trailing spaces from a text input when it loses focus (a pasted email with a
 * trailing space is the usual culprit). It re-dispatches `input` so the bound value follows.
 * Never use it on a password: spaces there are part of the secret.
 */
@Directive({
  selector: 'input[appTrimOnBlur]',
  host: { '(blur)': 'trim()' },
})
export class TrimOnBlurDirective {
  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;

  protected trim(): void {
    const trimmed = this.input.value.trim();
    if (trimmed !== this.input.value) {
      this.input.value = trimmed;
      this.input.dispatchEvent(new Event('input'));
    }
  }
}
