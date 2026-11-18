import { Component, computed, input } from '@angular/core';
import type { Person } from '@core/auth/identity.models';
import { Chip } from '@openng/optimus-ui/chip';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import type { FloatingReaction } from '../../models/reaction.model';
import { memberOf, seedHash } from '../../utils/members';
import { REACTION_LOOKS } from '../../utils/reactions';

const LANES = 5;

@Component({
  selector: 'app-reaction-stream',
  imports: [Chip, TranslatePipe],
  template: `
    <ul aria-hidden="true">
      @for (item of items(); track item.id) {
        <li [style.--lane]="item.lane">
          @if (item.me) {
            <p-chip [icon]="item.icon" [label]="'You' | t" />
          } @else {
            <p-chip [icon]="item.icon" [label]="item.name" />
          }
        </li>
      }
    </ul>
  `,
  styleUrl: './reaction-stream.component.scss',
})
export class ReactionStreamComponent {
  readonly reactions = input.required<readonly FloatingReaction[]>();
  readonly members = input.required<ReadonlyMap<string, Person>>();
  readonly meId = input<string | null>(null);

  protected readonly items = computed(() =>
    this.reactions().map((item) => ({
      id: item.id,
      icon: REACTION_LOOKS[item.reaction].icon,
      name: memberOf(this.members(), item.userId).name,
      me: item.userId === this.meId(),
      lane: seedHash(item.userId) % LANES,
    })),
  );
}
