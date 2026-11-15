import { Component, computed, input, output, signal } from '@angular/core';
import { AvatarGroup } from '@openng/optimus-ui/avatargroup';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import type { Member } from '../../models/room.model';
import { memberOf } from '../../utils/members';
import { AudienceGridComponent } from '../audience-grid/audience-grid.component';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

const PREVIEW = 5;

/**
 * The listeners, kept out of the way: a heading with the count and a few faces, and the full list only when asked for, so a
 * big room's audience never competes with the conversation.
 */
@Component({
  selector: 'app-audience-section',
  imports: [AudienceGridComponent, AvatarGroup, PersonAvatarComponent, TranslatePipe],
  template: `
    <h2 class="heading">
      <button
        type="button"
        class="toggle"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="listId"
        (click)="open.set(!open())"
      >
        <span class="title">{{ 'Listeners' | t }}</span>
        <span class="count">{{ ids().length }}</span>
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
        <i
          class="pi chevron"
          aria-hidden="true"
          [class.pi-chevron-down]="!open()"
          [class.pi-chevron-up]="open()"
        ></i>
      </button>
    </h2>
    <div [id]="listId" [hidden]="!open()">
      @if (open()) {
        <app-audience-grid
          [ids]="ids()"
          [members]="members()"
          [meId]="meId()"
          [reconnecting]="reconnecting()"
          (memberSelected)="memberSelected.emit($event)"
        />
      }
    </div>
  `,
  styleUrl: './audience-section.component.scss',
})
export class AudienceSectionComponent {
  readonly ids = input.required<readonly string[]>();
  readonly members = input.required<ReadonlyMap<string, Member>>();
  readonly meId = input<string | null>(null);
  readonly reconnecting = input<readonly string[]>([]);

  readonly memberSelected = output<string>();

  protected readonly open = signal(false);
  protected readonly listId = `app-audience-${nextId++}`;
  protected readonly preview = computed(() =>
    this.ids()
      .slice(0, PREVIEW)
      .map((id) => memberOf(this.members(), id)),
  );
  protected readonly more = computed(() => Math.max(0, this.ids().length - PREVIEW));
}

let nextId = 0;
