import { Component, input, output } from '@angular/core';
import { MenuItem } from '@openng/optimus-ui/api';
import { Avatar } from '@openng/optimus-ui/avatar';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Card } from '@openng/optimus-ui/card';
import { Menu } from '@openng/optimus-ui/menu';
import { AriaCurrentDirective } from '@shared/directives/aria-current.directive';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { LiveWavesComponent } from '@shared/ui/live-waves/live-waves.component';
import {
  type CurrentRoom,
  CurrentRoomCardComponent,
} from './current-room-card/current-room-card.component';

/**
 * The left rail from 64rem: the pages as the library's own menu with the brand in its start slot, the Go live card (or, while the person is in a room elsewhere,
 * the card that takes them back to it), and the account at the foot. It only shows what it is given and says what was pressed; the shell decides what that does. How the menu looks is in the
 * preset; this stylesheet is the rail's layout.
 */
@Component({
  selector: 'app-sidebar',
  imports: [
    Avatar,
    AriaCurrentDirective,
    ButtonDirective,
    Card,
    CurrentRoomCardComponent,
    LiveWavesComponent,
    Menu,
    TranslatePipe,
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  host: { role: 'complementary' },
})
export class SidebarComponent {
  // The brand (a link to the front page, which a presentational component cannot draw) comes in as content marked `[brand]`.
  /** The pages, already in the reader's language. */
  readonly items = input.required<readonly MenuItem[]>();
  /** The signed-in person: name, the two languages as flags, and their picture if they chose one. */
  readonly name = input('');
  readonly languages = input('');
  readonly picture = input<string | null>(null);

  /** The room the person is in while they look elsewhere: a card about it then takes the Go live card's place. */
  readonly room = input<CurrentRoom | null>(null);
  /** The person is looking at that room's own page, so nothing about it (or about starting another room) is offered. */
  readonly viewing = input(false);

  readonly startRoom = output<void>();
  readonly backToRoom = output<void>();
  /** The account was pressed; the event says where, so the settings can open beside it. */
  readonly settings = output<MouseEvent>();
}
