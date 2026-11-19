import { Component, input, output } from '@angular/core';
import type { MenuItem } from '@openng/optimus-ui/api';
import { Tag } from '@openng/optimus-ui/tag';
import { AudienceGridComponent } from '../audience-grid/audience-grid.component';
import type { Person } from '@core/auth/identity.models';
import type { FloatingReaction } from '../../models/reaction.model';

let nextId = 0;

@Component({
  selector: 'app-audience-section',
  imports: [AudienceGridComponent, Tag],
  template: `
    <section [attr.aria-labelledby]="headingId">
      <div class="head">
        <h2 class="heading" [id]="headingId">
          Audience
          <p-tag severity="secondary" [rounded]="true">{{ ids().length }} Listeners</p-tag>
        </h2>
        @if (swipeable() && ids().length > 0) {
          <span class="hint" aria-hidden="true">Swipe <i class="pi pi-arrow-right"></i></span>
        }
      </div>
      <app-audience-grid
        [layout]="swipeable() ? 'row' : 'grid'"
        [ids]="ids()"
        [members]="members()"
        [meId]="meId()"
        [reconnecting]="reconnecting()"
        [reactions]="reactions()"
        [moderation]="moderation()"
        (memberSelected)="memberSelected.emit($event)"
      />
    </section>
  `,
  styleUrl: './audience-section.component.scss',
})
export class AudienceSectionComponent {
  readonly ids = input.required<readonly string[]>();
  readonly members = input.required<ReadonlyMap<string, Person>>();
  readonly meId = input<string | null>(null);
  readonly reconnecting = input<readonly string[]>([]);
  /** On a phone the listeners are a row to swipe through, with their names; elsewhere a grid of faces. */
  readonly swipeable = input(false);
  readonly reactions = input<ReadonlyMap<string, FloatingReaction>>(new Map());
  readonly moderation = input<ReadonlyMap<string, readonly MenuItem[]>>(new Map());

  readonly memberSelected = output<string>();

  protected readonly headingId = `app-audience-${nextId++}`;
}
