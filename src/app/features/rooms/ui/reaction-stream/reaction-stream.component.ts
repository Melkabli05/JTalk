import { Component, computed, input } from '@angular/core';
import type { Person } from '@core/auth/identity.models';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import type { FloatingReaction } from '../../models/reaction.model';
import { memberOf } from '../../utils/members';
import { REACTION_LOOKS } from '../../utils/reactions';

const LANES = 5;

function laneOf(userId: string): number {
  return [...userId].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 997, 7) % LANES;
}

@Component({
  selector: 'app-reaction-stream',
  imports: [TranslatePipe],
  template: `
    <ul aria-hidden="true">
      @for (item of items(); track item.id) {
        <li [style.--lane]="item.lane">
          <i [class]="item.icon"></i>
          @if (item.me) {
            <span>{{ 'You' | t }}</span>
          } @else {
            <span>{{ item.name }}</span>
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
      lane: laneOf(item.userId),
    })),
  );
}
