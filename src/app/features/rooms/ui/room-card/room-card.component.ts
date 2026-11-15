import { Component, computed, input, output } from '@angular/core';
import { Avatar } from '@openng/optimus-ui/avatar';
import { AvatarGroup } from '@openng/optimus-ui/avatargroup';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Card } from '@openng/optimus-ui/card';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import type { Member, Room } from '../../models/room.model';
import { memberOf } from '../../utils/members';
import { roomLook } from '../../utils/room-look';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

const SHOWN_SPEAKERS = 5;

let nextId = 0;

/** One open room in the hallway: what it is, who is speaking, how busy it is, and a way in. */
@Component({
  selector: 'app-room-card',
  imports: [Avatar, AvatarGroup, ButtonDirective, Card, PersonAvatarComponent, TranslatePipe],
  templateUrl: './room-card.component.html',
  styleUrl: './room-card.component.scss',
})
export class RoomCardComponent {
  readonly room = input.required<Room>();
  readonly members = input.required<ReadonlyMap<string, Member>>();

  readonly opened = output<void>();

  protected readonly titleId = `app-room-card-${nextId++}`;
  protected readonly look = computed(() => roomLook(this.room()));
  protected readonly host = computed(() => memberOf(this.members(), this.room().hostId));
  protected readonly speakers = computed(() =>
    this.room()
      .speakers.slice(0, SHOWN_SPEAKERS)
      .map((id) => memberOf(this.members(), id)),
  );
  protected readonly more = computed(() =>
    Math.max(0, this.room().speakers.length - SHOWN_SPEAKERS),
  );
}
