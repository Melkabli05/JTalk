import { Component, input } from '@angular/core';

@Component({
  selector: 'app-brand-mark',
  template: '<span class="bar"></span><span class="bar"></span><span class="bar"></span>',
  styleUrl: './brand-mark.component.scss',
  host: { 'aria-hidden': 'true', '[class.animated]': 'animated()' },
})
export class BrandMarkComponent {
  readonly animated = input(false);
}
