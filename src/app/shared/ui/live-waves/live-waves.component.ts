import { Component, input } from '@angular/core';

/**
 * Glow waves that spread from the edge of whatever it is laid over, like a voice leaving it. Put it inside a box that has the same
 * rounded corners and it rings that box's border. Decoration only: it says nothing the words beside it do not, so it is hidden from
 * assistive technology, never catches a pointer, and stands still under `prefers-reduced-motion`. The waves are slow while nothing is
 * live and quicker and brighter while the person is in a live room (Forest means live).
 */
@Component({
  selector: 'app-live-waves',
  template: `
    <span class="wave one"></span>
    <span class="wave two"></span>
    <span class="wave three"></span>
  `,
  styleUrl: './live-waves.component.scss',
  host: { 'aria-hidden': 'true', '[class.live]': 'live()' },
})
export class LiveWavesComponent {
  readonly live = input(false);
}
