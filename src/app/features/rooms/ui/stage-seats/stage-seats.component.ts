import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { msg } from '@shared/utils/i18n/msg';
import type { Member } from '../../models/room.model';
import { memberOf } from '../../utils/members';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

/** The stage: the people speaking, and the seats still open (anyone may take one while there are some). */
@Component({
  selector: 'app-stage-seats',
  imports: [PersonAvatarComponent, TranslatePipe],
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
  /** Whose microphone is known to be off. */
  readonly muted = input<readonly string[]>([]);

  readonly memberSelected = output<string>();
  readonly seatTaken = output<void>();

  /** One speaker is the whole stage, up to four are large, more are smaller; past eight the stage scrolls. */
  protected readonly avatarSize = computed<'hero' | 'xlarge' | 'large'>(() => {
    const count = this.speakers().length;
    return count <= 1 ? 'hero' : count <= 4 ? 'xlarge' : 'large';
  });
  protected readonly scrolls = computed(() => this.speakers().length > 8);

  /**
   * The people on stage, in the order the server gave. Past eight the stage scrolls, and a person talking out of sight is the
   * hardest thing to find on a big stage, so the ones heard right now come first.
   */
  protected readonly onStage = computed(() => {
    const people = this.speakers().map((id) => {
      const host = id === this.hostId();
      return {
        member: memberOf(this.members(), id),
        host,
        me: id === this.meId(),
        speaking: this.speaking().includes(id),
        muted: this.muted().includes(id),
        role: host ? msg('Host') : msg('Speaker'),
      };
    });
    return this.scrolls()
      ? people.toSorted((a, b) => Number(b.speaking) - Number(a.speaking))
      : people;
  });
  /** The first seat nobody holds: one open seat is enough to say there is room, the rest would only crowd the people. */
  protected readonly nextSeat = computed(() =>
    this.speakers().length < this.seats() ? this.speakers().length + 1 : null,
  );
}
