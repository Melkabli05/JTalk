import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { RoomLauncher } from '../../../../core/services/room-launcher';
import { ToastNotifier } from '../../../../core/services/toast-notifier';
import { SkeletonLoader } from '../../../../shared/ui/skeleton-loader/skeleton-loader';
import { DEFAULT_HERO_SCENE } from '../../constants/hero-scenes.constants';
import { HERO_CYCLE_INTERVAL_MS } from '../../constants/rooms.constants';
import { LiveRoomCard } from '../../models/room-card.model';
import { RoomsStore } from '../../store/rooms-store';
import { LanguageChips } from '../../ui/language-chips/language-chips';
import { RoomCard } from '../../ui/room-card/room-card';
import { RoomsHero } from '../../ui/rooms-hero/rooms-hero';
import {
  getScenesForContext,
  resolveDayPeriod,
  resolveHeroSeason,
  selectHeroScene,
} from '../../utils/hero-scene.utils';

@Component({
  selector: 'app-rooms-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    RoomsHero,
    LanguageChips,
    RoomCard,
    SkeletonLoader,
  ],
  templateUrl: './rooms-page.html',
  styleUrl: './rooms-page.scss',
})
export class RoomsPage {
  readonly roomsStore = inject(RoomsStore);
  private readonly toast = inject(ToastNotifier);
  private readonly router = inject(Router);
  private readonly roomLauncher = inject(RoomLauncher);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heroClock = signal<Date | null>(null);
  private readonly heroOffset = signal(0);
  private lastRefreshTick = this.roomsStore.refreshTick();

  readonly hero = computed(() => {
    const now = this.heroClock();
    if (!now) {
      return {
        scenes: getScenesForContext(DEFAULT_HERO_SCENE.period, null),
        active: DEFAULT_HERO_SCENE,
      };
    }
    return {
      scenes: getScenesForContext(resolveDayPeriod(now.getHours()), resolveHeroSeason(now)),
      active: selectHeroScene(now, this.heroOffset()),
    };
  });

  constructor() {
    effect(() => {
      const tick = this.roomsStore.refreshTick();
      if (tick > this.lastRefreshTick) {
        this.lastRefreshTick = tick;
        untracked(() => this.toast.show('Rooms updated.'));
      }
    });

    afterNextRender(() => {
      this.heroClock.set(new Date());
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

      const timer = setInterval(() => this.cycleHeroScene(), HERO_CYCLE_INTERVAL_MS);
      this.destroyRef.onDestroy(() => clearInterval(timer));
    });
  }

  cycleHeroScene(): void {
    this.heroClock.set(new Date());
    this.heroOffset.update((offset) => offset + 1);
  }

  onRefreshRooms(): void {
    this.roomsStore.refresh();
  }

  onStartRoom(): void {
    void this.roomLauncher.openStartRoom(this.destroyRef);
  }

  onJoinRoom(room: LiveRoomCard): void {
    void this.router.navigate(['/room', room.id]);
  }

  onPinRoom(room: LiveRoomCard): void {
    this.roomsStore.pinRoom(room.id);
    this.toast.show('Pinned to top.');
  }

  onNotInterested(room: LiveRoomCard): void {
    this.roomsStore.hideRoom(room.id);
    this.toast.show('Hidden from list.');
  }
}
