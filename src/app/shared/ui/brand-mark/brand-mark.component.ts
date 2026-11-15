import { Component, input } from '@angular/core';

/**
 * The app's mark: three rounded bars of a voice, in Active Green, Moderator Gold and ink. Pure CSS,
 * decorative, and sized by `font-size` (the mark is 1em tall), filled from the `--p-jtalk-*` theme
 * tokens. `animated` makes the bars move like an equalizer, as a "working" indicator (the global
 * reduced-motion rule in the theme stills it).
 */
@Component({
  selector: 'app-brand-mark',
  template: '<span class="bar"></span><span class="bar"></span><span class="bar"></span>',
  styleUrl: './brand-mark.component.scss',
  host: { 'aria-hidden': 'true', '[class.animated]': 'animated()' },
})
export class BrandMarkComponent {
  readonly animated = input(false);
}
