import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IdentityStore } from '../../../../core/auth/identity';
import { RoomLauncher } from '../../../../core/services/room-launcher';
import { LiveRoomCard } from '../../../rooms/models/room-card.model';
import { RoomsStore } from '../../../rooms/store/rooms-store';
import {
  EASE_EDITORIAL,
  EASE_SNAPPY,
  GREETING_INTERVAL_MS,
  ROOM_CYCLE_INTERVAL_MS,
} from '../../constants/home.constants';
import {
  formatEditorialIndex,
  formatLiveRoomsSummary,
  HOME_GREETINGS,
  nextCyclicIndex,
} from '../../utils/home-greetings';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly roomLauncher = inject(RoomLauncher);
  readonly identity = inject(IdentityStore);
  readonly roomsStore = inject(RoomsStore);

  private readonly shellRef = viewChild<ElementRef<HTMLElement>>('homeShell');
  private readonly liveStripRef = viewChild<ElementRef<HTMLElement>>('liveStrip');

  readonly greetings = HOME_GREETINGS;
  readonly greetingIndex = signal(1);
  readonly selectedRoomIndex = signal(0);
  readonly autoCyclePaused = signal(false);

  readonly rooms = this.roomsStore.rooms;

  readonly activeGreeting = computed(
    () => this.greetings[this.greetingIndex()] ?? this.greetings[0],
  );

  readonly liveSummary = computed(() => {
    if (!this.identity.isAuthenticated()) {
      return 'Drop-in voice rooms';
    }
    return formatLiveRoomsSummary(this.roomsStore.liveCount());
  });

  readonly selectedRoom = computed<LiveRoomCard | null>(() => {
    const list = this.rooms();
    if (list.length === 0) return null;
    const idx = this.selectedRoomIndex() % list.length;
    return list[idx] ?? list[0] ?? null;
  });

  readonly activeCounterLabel = computed(() => {
    const total = this.rooms().length;
    if (total === 0) return '00 / 00';
    const current = this.selectedRoomIndex() % total;
    return `${formatEditorialIndex(current)} / ${formatEditorialIndex(total - 1)}`;
  });

  constructor() {
    effect(() => {
      if (this.identity.isAuthenticated()) {
        this.roomsStore.ensureLoaded();
      }
    });

    afterNextRender(() => {
      const reducedMotion = this.prefersReducedMotion();

      if (!reducedMotion && this.supportsWebAnimations()) {
        this.runEntranceChoreography();
      }

      if (reducedMotion) return;

      const greetingTimer = window.setInterval(() => {
        this.cycleGreeting();
      }, GREETING_INTERVAL_MS);

      const roomTimer = window.setInterval(() => {
        if (this.autoCyclePaused()) return;
        const total = this.rooms().length;
        if (total < 2) return;
        this.selectedRoomIndex.update((i) => nextCyclicIndex(i, total));
        this.animateLiveStrip();
      }, ROOM_CYCLE_INTERVAL_MS);

      this.destroyRef.onDestroy(() => {
        window.clearInterval(greetingTimer);
        window.clearInterval(roomTimer);
      });
    });
  }

  cycleRoom(): void {
    const total = this.rooms().length;
    if (total < 2) return;
    this.autoCyclePaused.set(true);
    this.selectedRoomIndex.update((i) => nextCyclicIndex(i, total));
    this.animateLiveStrip();
  }

  cycleGreeting(): void {
    this.greetingIndex.update((i) => nextCyclicIndex(i, this.greetings.length));
  }

  onPrimaryMagnetMove(event: PointerEvent): void {
    if (this.prefersReducedMotion() || event.pointerType !== 'mouse') return;
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    const rect = target.getBoundingClientRect();
    const dx = ((event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)) * 3.5;
    const dy = ((event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)) * 2.5;
    target.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
  }

  onPrimaryMagnetLeave(event: PointerEvent): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    target.style.transform = '';
  }

  enterRooms(): void {
    if (this.identity.isAuthenticated()) {
      void this.router.navigate(['/rooms']);
      return;
    }
    const nextPath = this.route.snapshot.queryParamMap.get('next') || '/rooms';
    this.identity.signIn('login', nextPath);
  }

  openStartRoom(): void {
    if (!this.identity.isAuthenticated()) {
      this.identity.signIn('signup', '/rooms');
      return;
    }
    this.roomLauncher.openStartRoom(this.destroyRef);
  }

  joinRoom(room: LiveRoomCard): void {
    if (!this.identity.isAuthenticated()) {
      this.identity.signIn('login', `/room/${room.id}`);
      return;
    }
    void this.router.navigate(['/room', room.id]);
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  private supportsWebAnimations(): boolean {
    return typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
  }

  private runEntranceChoreography(): void {
    const root = this.shellRef()?.nativeElement;
    if (!root) return;

    root.querySelector('.home-header')?.animate(
      { opacity: [0, 1], transform: ['translateY(-6px)', 'translateY(0)'] },
      { duration: 450, easing: EASE_SNAPPY },
    );
    root.querySelectorAll('.home-line-reveal').forEach((line, index) => {
      line.animate(
        { opacity: [0.01, 1], transform: ['translateY(106%)', 'translateY(0)'] },
        { duration: 700, delay: 50 + index * 80, easing: EASE_EDITORIAL, fill: 'backwards' },
      );
    });
    root.querySelectorAll('.home-anim-fade').forEach((item, index) => {
      item.animate(
        { opacity: [0, 1], transform: ['translateY(12px)', 'translateY(0)'] },
        { duration: 540, delay: 160 + index * 75, easing: EASE_SNAPPY, fill: 'backwards' },
      );
    });
  }

  private animateLiveStrip(): void {
    if (this.prefersReducedMotion() || !this.supportsWebAnimations()) return;
    const strip = this.liveStripRef()?.nativeElement;
    if (!strip) return;
    strip.animate(
      { opacity: [0.25, 1], transform: ['translateY(6px)', 'translateY(0)'] },
      { duration: 280, easing: EASE_EDITORIAL },
    );
  }
}
