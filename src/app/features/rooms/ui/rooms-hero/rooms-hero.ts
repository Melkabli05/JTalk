import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RoomLangFilter } from '../../constants/rooms.constants';
import { HeroScene } from '../../models/hero-scene.model';
import { formatHeroStatusPill, formatHeroSubtitle } from '../../utils/hero-scene.utils';
import { type HeroThreeStage, mountHeroThreeStage } from '../../utils/hero-three-stage';

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
    '(pointermove)': 'onPointerMove($event)',
    '(pointerleave)': 'onPointerLeave()',
  },
  templateUrl: './rooms-hero.html',
  styleUrl: './rooms-hero.scss',
})
export class RoomsHero {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('heroCanvas');

  readonly liveCount = input.required<number>();
  readonly activeFilter = input<RoomLangFilter>('all');
  readonly activeFilterLabel = input('All languages');
  readonly scenes = input.required<readonly HeroScene[]>();
  readonly activeScene = input.required<HeroScene>();

  readonly nextScene = output<void>();
  readonly startRoom = output<void>();

  private stage: HeroThreeStage | null = null;

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

  constructor() {
    effect(() => {
      const current = this.activeScene();
      const index = Math.max(
        0,
        this.scenes().findIndex((scene) => scene.id === current.id),
      );
      this.stage?.setScene(current.period, index);
    });

    afterNextRender(() => {
      const canvas = this.canvasRef()?.nativeElement;
      const host = this.hostRef.nativeElement;
      if (!canvas) return;

      const view = this.document.defaultView;
      const reducedMotion = Boolean(view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      const current = this.activeScene();
      const index = Math.max(
        0,
        this.scenes().findIndex((scene) => scene.id === current.id),
      );

      let destroyed = false;
      let inViewport = true;

      const syncVisibility = () => {
        this.stage?.setVisible(inViewport && !this.document.hidden);
      };

      const onVisibilityChange = () => syncVisibility();
      this.document.addEventListener('visibilitychange', onVisibilityChange);

      const resizeObserver =
        typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(() => {
              this.stage?.resize(host.clientWidth, host.clientHeight);
            })
          : null;
      resizeObserver?.observe(host);

      const intersectionObserver =
        typeof IntersectionObserver !== 'undefined'
          ? new IntersectionObserver((entries) => {
              inViewport = entries.some((entry) => entry.isIntersecting);
              syncVisibility();
            })
          : null;
      intersectionObserver?.observe(host);

      void mountHeroThreeStage(canvas, current.period, index, reducedMotion).then((mounted) => {
        if (!mounted) return;
        if (destroyed) {
          mounted.dispose();
          return;
        }
        this.stage = mounted;
        mounted.resize(host.clientWidth, host.clientHeight);
        syncVisibility();
      });

      this.destroyRef.onDestroy(() => {
        destroyed = true;
        this.document.removeEventListener('visibilitychange', onVisibilityChange);
        resizeObserver?.disconnect();
        intersectionObserver?.disconnect();
        this.stage?.dispose();
        this.stage = null;
      });
    });
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.stage || event.pointerType === 'touch') return;
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    this.stage.setPointer(nx, ny);
  }

  onPointerLeave(): void {
    this.stage?.setPointer(0, 0);
  }
}
