import { Component, computed, input, output } from '@angular/core';
import { Avatar } from '@openng/optimus-ui/avatar';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Card } from '@openng/optimus-ui/card';
import { Tag } from '@openng/optimus-ui/tag';
import { InitialsPipe } from '@shared/pipes/initials.pipe';
import { avatarColors, avatarUrl } from '@shared/utils/avatars';
import { languageOf } from '@shared/utils/languages';

/** What the card says about the room the person is in. */
export interface CurrentRoom {
  readonly title: string;
  readonly targetLanguage: string;
  readonly nativeLanguage: string;
  readonly hostId: string;
  /** The host's name and the id of the picture they chose, empty until they are known. */
  readonly hostName: string;
  readonly hostAvatar: string;
  readonly participantCount: number;
  /** How many are on the stage, and how many seats it has. */
  readonly speakers: number;
  readonly seats: number;
}

/**
 * The card the sidebar shows while the person is in a room and looking at something else: that they are in it (Live), which room, its
 * languages, its host, how busy it is, and the way back. It only shows what it is given and says that going back was asked for.
 */
@Component({
  selector: 'app-current-room-card',
  imports: [Avatar, ButtonDirective, Card, InitialsPipe, Tag],
  templateUrl: './current-room-card.component.html',
  styleUrl: './current-room-card.component.scss',
})
export class CurrentRoomCardComponent {
  readonly room = input.required<CurrentRoom>();

  readonly back = output<void>();

  /** The languages of the room, with their flags. */
  protected readonly languages = computed(() => ({
    target: languageOf(this.room().targetLanguage),
    native: languageOf(this.room().nativeLanguage),
  }));

  /** The host as a face and a name: their picture, or their initials in the colour they are always drawn in; nothing until the name is known. */
  protected readonly host = computed(() => {
    const room = this.room();
    return room.hostName
      ? {
          name: room.hostName,
          picture: avatarUrl(room.hostAvatar),
          colors: avatarColors(room.hostId),
        }
      : null;
  });
}
