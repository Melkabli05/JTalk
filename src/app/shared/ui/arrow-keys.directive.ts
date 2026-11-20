import { Directionality } from '@angular/cdk/bidi';
import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, inject } from '@angular/core';

/**
 * Arrow keys, Home and End move focus between the buttons and links inside, as the toolbar pattern asks; the arrow that goes forward follows
 * the reading direction. Tab still visits every control, so nothing is hidden from someone who does not know the arrows.
 */
@Directive({
  selector: '[appArrowKeys]',
  host: { '(keydown)': 'move($event)' },
})
export class ArrowKeysDirective {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly direction = inject(Directionality);
  private readonly document = inject(DOCUMENT);

  protected move(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const items = [
      ...this.element.nativeElement.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]'),
    ];
    const at = items.indexOf(this.document.activeElement as HTMLElement);
    const rtl = this.direction.value === 'rtl';
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')
            ? at + 1
            : event.key === (rtl ? 'ArrowRight' : 'ArrowLeft')
              ? at - 1
              : undefined;
    if (at < 0 || next === undefined) {
      return;
    }
    event.preventDefault();
    items.at(next % items.length)?.focus();
  }
}
