import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HeroScene } from '../../models/hero-scene.model';
import { RoomLangFilter } from '../../constants/rooms.constants';
import { formatHeroStatusPill, formatHeroSubtitle } from '../../utils/hero-scene.utils';

@Component({
  selector: 'app-rooms-hero',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  host: {
    class: 'hero',
    role: 'region',
    'aria-label': 'Welcome',
    '[attr.data-period]': 'activeScene().period',
    '[attr.data-season]': "activeScene().season ?? 'default'",
    '[class.is-empty]': 'isEmpty()',
  },
  templateUrl: './rooms-hero.html',
  styleUrl: './rooms-hero.scss',
})
export class RoomsHero {
  readonly liveCount = input.required<number>();
  readonly activeFilter = input<RoomLangFilter>('all');
  readonly activeFilterLabel = input('All languages');
  readonly scenes = input.required<readonly HeroScene[]>();
  readonly activeScene = input.required<HeroScene>();

  readonly nextScene = output<void>();
  readonly startRoom = output<void>();

  readonly isEmpty = computed(() => this.liveCount() <= 0);

  readonly statusPillText = computed(() =>
    formatHeroStatusPill(this.liveCount(), this.activeFilter(), this.activeFilterLabel()),
  );

  readonly heroSubtitle = computed(() =>
    formatHeroSubtitle(
      this.activeScene(),
      this.liveCount(),
      this.activeFilter(),
      this.activeFilterLabel(),
    ),
  );
}
