import { Component, input } from '@angular/core';

/**
 * A microphone with glow waves spreading from it, like a voice leaving a room. Decoration only: it says nothing the words beside it do
 * not, so it is hidden from assistive technology, and it stands still under `prefers-reduced-motion`. The waves are slow while nothing is
 * live and quicker and brighter while the person is in a live room (Forest means live).
 */
@Component({
  selector: 'app-live-waves',
  template: `
    <span class="wave one"></span>
    <span class="wave two"></span>
    <span class="wave three"></span>
    <span class="core"><i class="pi pi-microphone"></i></span>
  `,
  styleUrl: './live-waves.component.scss',
  host: { 'aria-hidden': 'true', '[class.live]': 'live()' },
})
export class LiveWavesComponent {
  readonly live = input(false);
}
