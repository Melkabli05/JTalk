import { Component, computed, input, output } from '@angular/core';
import type { MenuItem } from '@openng/optimus-ui/api';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { msg } from '@shared/utils/i18n/msg';
import { memberOf } from '../../utils/members';
import { ModerationMenuComponent } from '../moderation-menu/moderation-menu.component';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';
import type { Person } from '@core/auth/identity.models';
import type { FloatingReaction } from '../../models/reaction.model';

@Component({
  selector: 'app-stage-seats',
  imports: [ModerationMenuComponent, PersonAvatarComponent, TranslatePipe],
  templateUrl: './stage-seats.component.html',
  styleUrl: './stage-seats.component.scss',
})
export class StageSeatsComponent {
  readonly speakers = input.required<readonly string[]>();
  readonly seats = input.required<number>();
  readonly hostId = input.required<string>();
  readonly meId = input<string | null>(null);
  readonly members = input.required<ReadonlyMap<string, Person>>();
  readonly canTakeSeat = input(false);
  readonly speaking = input<readonly string[]>([]);
  readonly muted = input<readonly string[]>([]);
  readonly reactions = input<ReadonlyMap<string, FloatingReaction>>(new Map());
  /** What the host may do to each person, by id; people without an entry get no menu. */
  readonly moderation = input<ReadonlyMap<string, readonly MenuItem[]>>(new Map());

  readonly memberSelected = output<string>();
  readonly seatTaken = output<void>();

  protected readonly avatarSize = computed<'hero' | 'xlarge' | 'large'>(() => {
    const count = this.speakers().length;
    return count <= 1 ? 'hero' : count <= 4 ? 'xlarge' : 'large';
  });
  protected readonly scrolls = computed(() => this.speakers().length > 8);

  protected readonly onStage = computed(() => {
    const people = this.speakers().map((id) => {
      const host = id === this.hostId();
      return {
        member: memberOf(this.members(), id),
        host,
        me: id === this.meId(),
        speaking: this.speaking().includes(id),
        muted: this.muted().includes(id),
        reaction: this.reactions().get(id) ?? null,
        actions: this.moderation().get(id) ?? [],
        role: host ? msg('Host') : msg('Speaker'),
      };
    });
    return this.scrolls()
      ? people.toSorted((a, b) => Number(b.speaking) - Number(a.speaking))
      : people;
  });
  protected readonly nextSeat = computed(() =>
    this.speakers().length < this.seats() ? this.speakers().length + 1 : null,
  );
}
