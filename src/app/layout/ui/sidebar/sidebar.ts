import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AppView } from '../../../core/models/session.model';

@Component({
  selector: 'app-sidebar',
  imports: [
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatButtonToggleModule,
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
  readonly activeRoomSeats = input(6);
  readonly colorScheme = input<'light' | 'dark' | 'system'>('system');

  readonly toggleCollapse = output<void>();
  readonly startRoom = output<void>();
  readonly backToRoom = output<void>();
  readonly openProfileOverview = output<void>();
  readonly colorSchemeChange = output<'light' | 'dark' | 'system'>();

  readonly showInRoomCard = computed(() => this.inRoom() && this.activeView() !== 'room');

  readonly toggleLabel = computed(() =>
    this.collapsed() ? 'Open sidebar' : 'Collapse sidebar',
  );

  readonly themeIcon = computed(() => {
    switch (this.colorScheme()) {
      case 'light':
        return 'light_mode';
      case 'dark':
        return 'dark_mode';
      default:
        return 'contrast';
    }
  });

  readonly themeTooltip = computed(() => {
    switch (this.colorScheme()) {
      case 'light':
        return 'Theme: Light (click to switch)';
      case 'dark':
        return 'Theme: Dark (click to switch)';
      default:
        return 'Theme: System (click to switch)';
    }
  });

  cycleColorScheme(): void {
    const next =
      this.colorScheme() === 'system'
        ? 'light'
        : this.colorScheme() === 'light'
          ? 'dark'
          : 'system';
    this.colorSchemeChange.emit(next);
  }

  readonly avatarInitial = computed(() => {
    const trimmed = this.profileName().trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : 'J';
  });
}
