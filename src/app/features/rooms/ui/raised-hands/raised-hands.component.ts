import { Component, computed, input, output } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { memberOf } from '../../utils/members';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';
import type { Person } from '@core/auth/identity.models';

@Component({
  selector: 'app-raised-hands',
  imports: [ButtonDirective, PersonAvatarComponent, TranslatePipe],
  template: `
    <ol class="hands" [attr.aria-label]="'Raised hands' | t">
      @for (person of people(); track person.id) {
        <li>
          <span class="position" aria-hidden="true">{{ $index + 1 }}</span>
          <app-person-avatar size="normal" [member]="person" />
          <span class="name">{{ person.name }}</span>
          @if (canInvite()) {
            <button
              pButton
              type="button"
              size="small"
              icon="pi pi-microphone"
              [label]="'Invite' | t"
              [attr.aria-label]="'Invite {name} to the stage' | t: { name: person.name }"
              (click)="invited.emit(person.id)"
            ></button>
          }
        </li>
      }
    </ol>
  `,
  styleUrl: './raised-hands.component.scss',
})
export class RaisedHandsComponent {
  readonly ids = input.required<readonly string[]>();
  readonly members = input.required<ReadonlyMap<string, Person>>();
  readonly canInvite = input(false);

  readonly invited = output<string>();

  protected readonly people = computed(() => this.ids().map((id) => memberOf(this.members(), id)));
}
