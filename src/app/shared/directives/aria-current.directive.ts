import { afterEveryRender, afterRenderEffect, Directive, ElementRef, inject } from '@angular/core';
import { isActive, Router } from '@angular/router';

/**
 * Marks the link for the current page with `aria-current="page"` inside a host that renders its own links, such
 * as an Optimus menu (which only adds a CSS class, so assistive tech cannot tell where you are). A link counts
 * as current when the router says its URL is active: the same page or any page below it, ignoring query strings.
 */
@Directive({ selector: '[appAriaCurrent]' })
export class AriaCurrentDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly router = inject(Router);

  constructor() {
    // Two triggers, because neither alone is enough. `isActive` is a signal that follows the router state, so the
    // effect re-runs on every navigation even when nothing in the host re-renders. The per-render hook catches links
    // the host draws after this directive first ran (an Optimus menu renders its items on its own schedule).
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
