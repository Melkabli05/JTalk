import { Component, computed, input, output } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-mobile-tabbar',
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatRippleModule],
  host: {
    class: 'mobile-tabbar',
    role: 'navigation',
    'aria-label': 'Main',
  },
  templateUrl: './mobile-tabbar.html',
  styleUrl: './mobile-tabbar.scss',
})
export class MobileTabbar {
  readonly profileName = input('Jilali');
  readonly avatarUrl = input<string | null>(null);

  readonly startRoom = output<void>();
  readonly openProfileOverview = output<void>();

  readonly avatarInitial = computed(() => {
    const trimmed = this.profileName().trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : 'J';
  });
}
