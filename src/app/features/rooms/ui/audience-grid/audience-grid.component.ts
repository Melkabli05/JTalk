import { Component, computed, input, output } from '@angular/core';
import type { MenuItem } from '@openng/optimus-ui/api';
import { Tag } from '@openng/optimus-ui/tag';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { msg } from '@shared/utils/i18n/msg';
import { memberOf } from '../../utils/members';
import { ModerationMenuComponent } from '../moderation-menu/moderation-menu.component';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';
import type { Person } from '@core/auth/identity.models';
import type { FloatingReaction } from '../../models/reaction.model';

@Component({
  selector: 'app-audience-grid',
  imports: [ModerationMenuComponent, PersonAvatarComponent, Tag, TranslatePipe],
  template: `
    <ul class="audience" [attr.aria-label]="'In the audience' | t">
      @for (person of people(); track person.member.id) {
        <li>
          <app-moderation-menu [name]="person.member.name" [items]="person.actions">
            <button
              type="button"
              class="person"
              aria-haspopup="dialog"
              [attr.aria-label]="
                person.me
                  ? ('{name} (you), {role}'
                    | t: { name: person.member.name, role: person.role | t })
                  : ('{name}, {role}' | t: { name: person.member.name, role: person.role | t })
              "
              (click)="memberSelected.emit(person.member.id)"
            >
              <app-person-avatar [member]="person.member" [reaction]="person.reaction" />
              <span class="name" aria-hidden="true">{{ person.member.name }}</span>
              @if (person.me) {
                <p-tag severity="info" aria-hidden="true" [value]="'You' | t" />
              }
              @if (person.reconnecting) {
                <p-tag severity="secondary" icon="pi pi-sync" [value]="'Reconnecting' | t" />
              }
            </button>
          </app-moderation-menu>
        </li>
      } @empty {
        <li class="empty">{{ 'Nobody is listening yet.' | t }}</li>
      }
    </ul>
  `,
  styleUrl: './audience-grid.component.scss',
})
export class AudienceGridComponent {
  readonly ids = input.required<readonly string[]>();
  readonly members = input.required<ReadonlyMap<string, Person>>();
  readonly meId = input<string | null>(null);
  readonly reconnecting = input<readonly string[]>([]);
  readonly reactions = input<ReadonlyMap<string, FloatingReaction>>(new Map());
  /** What the host may do to each person, by id; people without an entry get no menu. */
  readonly moderation = input<ReadonlyMap<string, readonly MenuItem[]>>(new Map());

  readonly memberSelected = output<string>();

  protected readonly people = computed(() =>
    this.ids().map((id) => ({
      member: memberOf(this.members(), id),
      me: id === this.meId(),
      reconnecting: this.reconnecting().includes(id),
      reaction: this.reactions().get(id) ?? null,
      actions: this.moderation().get(id) ?? [],
      role: msg('Listener'),
    })),
  );
}
