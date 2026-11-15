import { Directive, ElementRef, inject } from '@angular/core';

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
