import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';
import type { ColorScheme } from '../../../core/models/theme.model';
import type { AppView } from '../../models/layout.model';

@Component({
  selector: 'app-sidebar',
  imports: [
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatListModule,
    MatRippleModule,
    MatTooltipModule,
  ],
  host: {
    class: 'sidebar',
    role: 'complementary',
  },
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  readonly collapsed = input.required<boolean>();
  readonly liveRoomsCount = input(4);
  readonly profileName = input('Jilali');
  readonly avatarUrl = input<string | null>(null);
  readonly inRoom = input(false);
  readonly activeView = input<AppView>('rooms');
  readonly activeRoomTitle = input('Practice room');
  readonly activeRoomLang = input('English');
  readonly activeRoomSeats = input(8);
  readonly activeRoomRole = input<'host' | 'speaker' | 'listener'>('listener');
  readonly colorScheme = input<ColorScheme>('light');

  readonly toggleCollapse = output<void>();
  readonly startRoom = output<void>();
  readonly backToRoom = output<void>();
  readonly toggleTheme = output<void>();

  readonly showInRoomCard = computed(() => this.inRoom() && this.activeView() !== 'room');

  readonly activeRoomRoleLabel = computed(() => {
    switch (this.activeRoomRole()) {
      case 'host':
        return 'Host · You';
      case 'speaker':
        return 'Speaker · You';
      case 'listener':
        return 'Listening';
    }
  });

  readonly toggleLabel = computed(() => (this.collapsed() ? 'Open sidebar' : 'Collapse sidebar'));

  readonly themeIcon = computed(() => (this.colorScheme() === 'dark' ? 'light_mode' : 'dark_mode'));

  readonly themeLabel = computed(() =>
    this.colorScheme() === 'dark' ? 'Light mode' : 'Dark mode',
  );

  readonly avatarInitial = computed(() => {
    const trimmed = this.profileName().trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : 'J';
  });
}
