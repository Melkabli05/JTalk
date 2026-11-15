import { Component, input } from '@angular/core';

export type StageState = 'done' | 'current' | 'todo';

@Component({
  selector: 'app-stage-marker',
  template: '<i [class]="icon()" aria-hidden="true"></i>',
  styleUrl: './stage-marker.component.scss',
  host: { '[attr.data-state]': 'state()' },
})
export class StageMarkerComponent {
  readonly icon = input.required<string>();
  readonly state = input.required<StageState>();
}
