import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { AvatarGroup } from '@openng/optimus-ui/avatargroup';
import { Panel } from '@openng/optimus-ui/panel';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import type { Member } from '../../models/room.model';
import { memberOf } from '../../utils/members';
import { AudienceGridComponent } from '../audience-grid/audience-grid.component';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

const PREVIEW = 5;
let nextId = 0;

/**
 * The listeners, kept out of the way. On a narrow screen an Optimus `p-panel` (collapsed by default) whose header carries the
 * count and a few faces and whose content is the full list; on a wide one, which has room beside the stage, a heading and the list.
 */
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
        [collapsed]="!open()"
        [toggleButtonProps]="{ ariaLabel: 'Listeners' | t }"
        (collapsedChange)="open.set(!$event)"
      >
        <ng-template #header>
          <div class="summary">
            <h2 class="heading">
              <span class="title">{{ 'Listeners' | t }}</span>
              <span class="count">{{ ids().length }}</span>
            </h2>
            @if (!open() && preview().length > 0) {
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
        @if (open()) {
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
  readonly members = input.required<ReadonlyMap<string, Member>>();
  readonly meId = input<string | null>(null);
  readonly reconnecting = input<readonly string[]>([]);
  /** A narrow screen folds the list away; a wide one has room to show it. */
  readonly collapsible = input(true);

  readonly memberSelected = output<string>();

  protected readonly open = signal(false);
  protected readonly panelId = `app-audience-${nextId++}`;
  protected readonly preview = computed(() =>
    this.ids()
      .slice(0, PREVIEW)
      .map((id) => memberOf(this.members(), id)),
  );
  protected readonly more = computed(() => Math.max(0, this.ids().length - PREVIEW));
}
