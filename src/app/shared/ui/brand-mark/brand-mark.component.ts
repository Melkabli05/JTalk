import { Component, input } from '@angular/core';

/**
 * Kandinsky's trio, the app's mark: a yellow triangle, a red square and a blue circle (his 1923 Bauhaus
 * questionnaire). Pure CSS, decorative, and sized by `font-size` (each shape is 1em), filled from the
 * `--p-jtalk-bauhaus-*` theme tokens. `animated` makes the shapes pulse one after the other, as a "working"
 * indicator (the global reduced-motion rule in the theme stills it).
 */
@Component({
  selector: 'app-brand-mark',
  template:
    '<span class="triangle"></span><span class="square"></span><span class="circle"></span>',
  styleUrl: './brand-mark.component.scss',
  host: { 'aria-hidden': 'true', '[class.animated]': 'animated()' },
})
export class BrandMarkComponent {
  readonly animated = input(false);
}
