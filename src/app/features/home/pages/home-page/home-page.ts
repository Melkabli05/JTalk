import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { sanitizeReturnUrl } from '../../../../core/auth/auth.utils';
import { IdentityStore } from '../../../../core/auth/identity';
import { SessionExpiryHandler } from '../../../../core/http/session-expiry';
import { PwaService } from '../../../../core/services/pwa';
import { RoomLauncher } from '../../../../core/services/room-launcher';
import { ThemeService } from '../../../../core/services/theme';
import { languageLabelFor } from '../../../../core/utils/language-codes';
import { VoiceRoomDto } from '../../../../shared/models/voice-room.model';
import { RoomsFacade } from '../../../rooms/store/rooms.facade';
import {
  EASE_EDITORIAL,
  EASE_SNAPPY,
  GREETING_INTERVAL_MS,
  ROOM_CYCLE_INTERVAL_MS,
} from '../../constants/home.constants';

interface HomeGreeting {
  readonly text: string;
  readonly lang: string;
  readonly dir?: 'ltr' | 'rtl';
}

const HOME_GREETINGS: readonly [HomeGreeting, ...HomeGreeting[]] = [
  { text: 'Hola', lang: 'es', dir: 'ltr' },
  { text: 'Hello', lang: 'en', dir: 'ltr' },
  { text: 'مرحبا', lang: 'ar', dir: 'rtl' },
  { text: 'こんにちは', lang: 'ja', dir: 'ltr' },
  { text: 'Bonjour', lang: 'fr', dir: 'ltr' },
  { text: 'Ciao', lang: 'it', dir: 'ltr' },
];

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly roomLauncher = inject(RoomLauncher);
  readonly identity = inject(IdentityStore);
  readonly roomsStore = inject(RoomsFacade);
  readonly theme = inject(ThemeService);
  readonly pwa = inject(PwaService);
  readonly sessionExpiry = inject(SessionExpiryHandler);

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly isAuthCallback = computed(
    () => this.queryParams().has('code') && this.queryParams().has('state'),
  );
  readonly nextTarget = computed(() => sanitizeReturnUrl(this.queryParams().get('next'), '/rooms'));
  readonly authBusy = computed(() => this.identity.isLoading() || this.isAuthCallback());

  readonly themeToggleLabel = computed(() =>
    this.theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode',
  );

  private readonly shellRef = viewChild<ElementRef<HTMLElement>>('homeShell');
  private readonly liveStripRef = viewChild<ElementRef<HTMLElement>>('liveStrip');
  private redirected = false;

  readonly greetings = HOME_GREETINGS;
  readonly greetingIndex = signal(1);
  readonly selectedRoomIndex = signal(0);
  readonly autoCyclePaused = signal(false);

  readonly rooms = this.roomsStore.rooms;

  readonly activeGreeting = computed(
    () => this.greetings[this.greetingIndex()] ?? this.greetings[0],
  );

  readonly liveSummary = computed(() => {
    if (!this.identity.isAuthenticated()) return 'Drop-in voice rooms';
    const count = this.roomsStore.liveCount();
    if (count <= 0) return 'Start the first room';
    return count === 1 ? '1 open now' : `${count} open now`;
  });

  readonly selectedRoom = computed<VoiceRoomDto | null>(() => {
    const list = this.rooms();
    if (list.length === 0) return null;
    const idx = this.selectedRoomIndex() % list.length;
    return list[idx] ?? list[0] ?? null;
  });

  readonly selectedRoomMeta = computed(() => {
    const room = this.selectedRoom();
    if (!room) return '';
    return `${languageLabelFor(room.targetLanguage)} · ${room.speakers.length} speaking · ${room.participantCount} participant${room.participantCount === 1 ? '' : 's'} · ${room.maxStageSeats} seats`;
  });

  readonly activeCounterLabel = computed(() => {
    const total = this.rooms().length;
    if (total === 0) return '00 / 00';
    const current = (this.selectedRoomIndex() % total) + 1;
    return `${String(current).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  });

  constructor() {
    effect(() => {
      if (this.identity.isLoading() || !this.identity.isAuthenticated()) return;
      const target = this.nextTarget();
      untracked(() => {
        if (this.redirected) return;
        this.redirected = true;
        void this.router.navigateByUrl(target, { replaceUrl: true });
      });
    });

    this.destroyRef.onDestroy(() => {
      this.sessionExpiry.clear();
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
        this.selectedRoomIndex.update((i) => (i + 1) % total);
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
    this.selectedRoomIndex.update((i) => (i + 1) % total);
    this.animateLiveStrip();
  }

  cycleGreeting(): void {
    this.greetingIndex.update((i) => (i + 1) % this.greetings.length);
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
    if (this.authBusy()) return;
    const target = this.nextTarget();
    if (this.identity.isAuthenticated()) {
      void this.router.navigateByUrl(target);
      return;
    }
    this.identity.signIn('login', target);
  }

  openStartRoom(): void {
    if (this.authBusy()) return;
    if (!this.identity.isAuthenticated()) {
      this.identity.signIn('login', '/rooms?action=start');
      return;
    }
    this.roomLauncher.openStartRoom(this.destroyRef);
  }

  joinRoom(room: VoiceRoomDto): void {
    if (this.authBusy()) return;
    if (!this.identity.isAuthenticated()) {
      this.identity.signIn('login', `/room/${room.id}`);
      return;
    }
    void this.router.navigate(['/room', room.id]);
  }

  onInstallApp(): void {
    void this.pwa.promptInstall();
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

    root
      .querySelector('.home-header')
      ?.animate(
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
