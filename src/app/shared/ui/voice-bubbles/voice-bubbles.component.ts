import { Component } from '@angular/core';

@Component({
  selector: 'app-voice-bubbles',
  template: `
    <span class="bubble gold"></span>
    <span class="bubble canvas"></span>
    <span class="bubble deep"></span>
    <span class="bubble wave"><i></i><i></i><i></i></span>
  `,
  styleUrl: './voice-bubbles.component.scss',
  host: { 'aria-hidden': 'true' },
})
export class VoiceBubblesComponent {}
