import { Component } from '@angular/core';

/** The decoration behind the home page: lights, a grid, two stepped shapes and a glass orb on each. Nothing in it is for anyone to read or press. */
@Component({
  selector: 'app-poster-backdrop',
  host: { 'aria-hidden': 'true' },
  template: `
    <div class="glow">
      <span class="orb forest"></span>
      <span class="orb sand"></span>
      <span class="orb coral"></span>
    </div>
    <div class="grid"></div>
    <div class="block one"></div>
    <div class="block two"></div>
    <span class="badge mic"><i class="pi pi-microphone"></i></span>
    <span class="badge hand"><i class="pi pi-hand"></i></span>
  `,
  styleUrl: './poster-backdrop.component.scss',
})
export class PosterBackdropComponent {}
