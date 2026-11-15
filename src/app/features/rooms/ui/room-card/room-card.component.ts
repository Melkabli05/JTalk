import { Component, computed, input, output } from '@angular/core';
import { AvatarGroup } from '@openng/optimus-ui/avatargroup';
import { Card } from '@openng/optimus-ui/card';
import { Tooltip } from '@openng/optimus-ui/tooltip';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import type { Room } from '../../models/room.model';
import { memberOf } from '../../utils/members';
import { roomLook } from '../../utils/room-look';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';
import type { Person } from '@core/auth/identity.models';

const SHOWN_OTHERS = 4;

let nextId = 0;

@Component({
  selector: 'app-room-card',
  imports: [AvatarGroup, Card, PersonAvatarComponent, Tooltip, TranslatePipe],
  templateUrl: './room-card.component.html',
  styleUrl: './room-card.component.scss',
})
export class RoomCardComponent {
  readonly room = input.required<Room>();
  readonly members = input.required<ReadonlyMap<string, Person>>();

  readonly opened = output<void>();

  protected readonly titleId = `app-room-card-${nextId++}`;
  protected readonly look = computed(() => roomLook(this.room()));
  protected readonly host = computed(() => {
    const room = this.room();
    const id = room.speakers.includes(room.hostId) ? room.hostId : room.speakers[0];
    return id === undefined ? undefined : memberOf(this.members(), id);
  });
  private readonly everyoneElse = computed(() =>
    this.room()
      .speakers.filter((id) => id !== this.host()?.id)
      .map((id) => memberOf(this.members(), id)),
  );
  protected readonly others = computed(() => this.everyoneElse().slice(0, SHOWN_OTHERS));
  protected readonly otherNames = computed(() =>
    this.others()
      .map((person) => person.name)
      .join(', '),
  );
  protected readonly more = computed(() => Math.max(0, this.everyoneElse().length - SHOWN_OTHERS));
  protected readonly openSeats = computed(() =>
    Math.max(0, this.room().maxStageSeats - this.room().speakers.length),
  );
}
