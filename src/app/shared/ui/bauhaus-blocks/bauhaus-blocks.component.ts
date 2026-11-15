import { Component } from '@angular/core';

@Component({
  selector: 'app-bauhaus-blocks',
  template: `
    <span class="block circle"></span>
    <span class="block triangle"></span>
    <span class="block square"></span>
    <span class="block quarter"></span>
  `,
  styleUrl: './bauhaus-blocks.component.scss',
  host: { 'aria-hidden': 'true' },
})
export class BauhausBlocksComponent {}
