import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { SkeletonLoader } from '../../../../shared/ui/skeleton-loader/skeleton-loader';
import { DEFAULT_HERO_SCENE } from '../../constants/hero-scenes.constants';
import {
  HERO_CYCLE_INTERVAL_MS,
  LANGUAGE_FILTER_CHIPS,
  parseRoomLangFilter,
  type RoomLangFilter,
} from '../../constants/rooms.constants';
import { RoomsFacade } from '../../store/rooms.facade';
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
  readonly facade = inject(RoomsFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heroClock = signal<Date | null>(null);
  private readonly heroOffset = signal(0);

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly filterChips = LANGUAGE_FILTER_CHIPS;
  readonly selectedFilter = linkedSignal<RoomLangFilter>(() =>
    parseRoomLangFilter(this.queryParams().get('lang')),
  );

  readonly activeFilterLabel = computed(
    () => this.filterChips.find((c) => c.value === this.selectedFilter())?.label ?? 'All languages',
  );

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
      const filter = this.selectedFilter();
      untracked(() => this.facade.setTargetLanguage(filter));
    });

    effect(() => {
      if (this.queryParams().get('action') !== 'start') return;
      untracked(() => {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { action: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
        this.facade.startRoom(this.destroyRef);
      });
    });

    this.destroyRef.onDestroy(() => this.facade.setTargetLanguage('all'));

    afterNextRender(() => {
      this.heroClock.set(new Date());
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

      const timer = setInterval(() => this.cycleHeroScene(), HERO_CYCLE_INTERVAL_MS);
      this.destroyRef.onDestroy(() => clearInterval(timer));
    });
  }

  onFilterChange(filter: RoomLangFilter): void {
    this.selectedFilter.set(filter);
    this.facade.setTargetLanguage(filter, this.route);
  }

  cycleHeroScene(): void {
    this.heroClock.set(new Date());
    this.heroOffset.update((offset): number => offset + 1);
  }

  onStartRoom(): void {
    this.facade.startRoom(this.destroyRef);
  }
}
