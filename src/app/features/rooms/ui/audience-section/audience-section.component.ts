import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { AvatarGroup } from '@openng/optimus-ui/avatargroup';
import { Panel } from '@openng/optimus-ui/panel';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { memberOf } from '../../utils/members';
import { AudienceGridComponent } from '../audience-grid/audience-grid.component';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';
import type { Person } from '@core/auth/identity.models';

const PREVIEW = 5;
let nextId = 0;

@Component({
  selector: 'app-audience-section',
  imports: [
    AudienceGridComponent,
    AvatarGroup,
    NgTemplateOutlet,
    Panel,
    PersonAvatarComponent,
    TranslatePipe,
  ],
  template: `
    @if (collapsible()) {
      <p-panel
        toggler="header"
        [id]="panelId"
        [toggleable]="true"
        [(collapsed)]="closed"
        [toggleButtonProps]="{ ariaLabel: 'Listeners' | t }"
      >
        <ng-template #header>
          <div class="summary">
            <h2 class="heading">
              <span class="title">{{ 'Listeners' | t }}</span>
              <span class="count">{{ ids().length }}</span>
            </h2>
            @if (closed() && preview().length > 0) {
              <p-avatargroup aria-hidden="true">
                @for (member of preview(); track member.id) {
                  <app-person-avatar size="normal" [member]="member" />
                }
              </p-avatargroup>
              @if (more() > 0) {
                <span class="more" aria-hidden="true">+{{ more() }}</span>
              }
            }
          </div>
        </ng-template>
        @if (!closed()) {
          <ng-container *ngTemplateOutlet="list" />
        }
      </p-panel>
    } @else {
      <section [attr.aria-labelledby]="panelId">
        <h2 class="heading" [id]="panelId">
          <span class="title">{{ 'Listeners' | t }}</span>
          <span class="count">{{ ids().length }}</span>
        </h2>
        <ng-container *ngTemplateOutlet="list" />
      </section>
    }

    <ng-template #list>
      <app-audience-grid
        [ids]="ids()"
        [members]="members()"
        [meId]="meId()"
        [reconnecting]="reconnecting()"
        (memberSelected)="memberSelected.emit($event)"
      />
    </ng-template>
  `,
  styleUrl: './audience-section.component.scss',
})
export class AudienceSectionComponent {
  readonly ids = input.required<readonly string[]>();
  readonly members = input.required<ReadonlyMap<string, Person>>();
  readonly meId = input<string | null>(null);
  readonly reconnecting = input<readonly string[]>([]);
  readonly collapsible = input(true);

  readonly memberSelected = output<string>();

  protected readonly closed = signal(true);
  protected readonly panelId = `app-audience-${nextId++}`;
  protected readonly preview = computed(() =>
    this.ids()
      .slice(0, PREVIEW)
      .map((id) => memberOf(this.members(), id)),
  );
  protected readonly more = computed(() => Math.max(0, this.ids().length - PREVIEW));
}
