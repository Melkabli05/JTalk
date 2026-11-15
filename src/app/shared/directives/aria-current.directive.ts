import { afterEveryRender, afterRenderEffect, Directive, ElementRef, inject } from '@angular/core';
import { isActive, Router } from '@angular/router';

@Directive({ selector: '[appAriaCurrent]' })
export class AriaCurrentDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly router = inject(Router);

  constructor() {
    afterRenderEffect(() => this.update());
    afterEveryRender(() => this.update());
  }

  private update(): void {
    for (const link of this.host.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      const active = isActive(link.getAttribute('href') ?? '', this.router, {
        paths: link.getAttribute('href') === '/' ? 'exact' : 'subset',
        queryParams: 'ignored',
        fragment: 'ignored',
        matrixParams: 'ignored',
      })();
      if (active) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    }
  }
}
