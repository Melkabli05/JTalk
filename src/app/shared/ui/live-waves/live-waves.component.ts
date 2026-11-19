import { Component } from '@angular/core';

/**
 * Glow waves that spread from the edge of whatever it is laid over, like a voice leaving it. Put it inside a box that has the same
 * rounded corners and it rings that box's border. Decoration only: it says nothing the words beside it do not, so it is hidden from
 * assistive technology, never catches a pointer, and stands still under `prefers-reduced-motion`.
 */
@Component({
  selector: 'app-live-waves',
  template: `
    <span class="wave one"></span>
    <span class="wave two"></span>
    <span class="wave three"></span>
  `,
  styleUrl: './live-waves.component.scss',
  host: { 'aria-hidden': 'true' },
})
export class LiveWavesComponent {}
