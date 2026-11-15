import { Component, computed, input, output } from '@angular/core';
import { Tag } from '@openng/optimus-ui/tag';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { msg } from '@shared/utils/i18n/msg';
import type { Member } from '../../models/room.model';
import { memberOf } from '../../utils/members';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

/** The stage: the people speaking, and the seats still open (anyone may take one while there are some). */
@Component({
  selector: 'app-stage-seats',
  imports: [PersonAvatarComponent, Tag, TranslatePipe],
  templateUrl: './stage-seats.component.html',
  styleUrl: './stage-seats.component.scss',
})
export class StageSeatsComponent {
  readonly speakers = input.required<readonly string[]>();
  readonly seats = input.required<number>();
  readonly hostId = input.required<string>();
  readonly meId = input<string | null>(null);
  readonly members = input.required<ReadonlyMap<string, Member>>();
  readonly canTakeSeat = input(false);
  /** Who is being heard right now. */
  readonly speaking = input<readonly string[]>([]);

  readonly memberSelected = output<string>();
  readonly seatTaken = output<void>();

  protected readonly onStage = computed(() =>
    this.speakers().map((id) => {
      const host = id === this.hostId();
      return {
        member: memberOf(this.members(), id),
        host,
        me: id === this.meId(),
        speaking: this.speaking().includes(id),
        role: host ? msg('Host') : msg('Speaker'),
      };
    }),
  );
  protected readonly openSeats = computed(() =>
    Array.from(
      { length: Math.max(0, this.seats() - this.speakers().length) },
      (_, index) => this.speakers().length + index + 1,
    ),
  );
}
