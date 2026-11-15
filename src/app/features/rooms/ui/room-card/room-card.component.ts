import { Component, computed, input, output } from '@angular/core';
import { Card } from '@openng/optimus-ui/card';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import type { Member, Room } from '../../models/room.model';
import { memberOf } from '../../utils/members';
import { roomLook } from '../../utils/room-look';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

const SHOWN_SPEAKERS = 3;

let nextId = 0;

/**
 * One open room in the hallway: what it is, who is on stage by name, how busy it is. The whole card opens the room (the title
 * is the button), so there is no separate Join.
 */
@Component({
  selector: 'app-room-card',
  imports: [Card, PersonAvatarComponent, TranslatePipe],
  templateUrl: './room-card.component.html',
  styleUrl: './room-card.component.scss',
})
export class RoomCardComponent {
  readonly room = input.required<Room>();
  readonly members = input.required<ReadonlyMap<string, Member>>();

  readonly opened = output<void>();

  protected readonly titleId = `app-room-card-${nextId++}`;
  protected readonly look = computed(() => roomLook(this.room()));
  /** The host first, then who else is on stage, up to a few: enough to tell who is in the room, short enough for a card. */
  protected readonly speakers = computed(() => {
    const room = this.room();
    return room.speakers
      .toSorted((a, b) => Number(b === room.hostId) - Number(a === room.hostId))
      .slice(0, SHOWN_SPEAKERS)
      .map((id) => ({ member: memberOf(this.members(), id), host: id === room.hostId }));
  });
  protected readonly more = computed(() =>
    Math.max(0, this.room().speakers.length - SHOWN_SPEAKERS),
  );
  protected readonly openSeats = computed(() =>
    Math.max(0, this.room().maxStageSeats - this.room().speakers.length),
  );
}
