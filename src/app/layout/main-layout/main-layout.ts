import { BreakpointObserver } from '@angular/cdk/layout';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { IdentityStore } from '../../core/auth/identity';
import { PwaService } from '../../core/services/pwa';
import { RoomLauncher } from '../../core/services/room-launcher';
import { ThemeService } from '../../core/services/theme';
import { ToastNotifier } from '../../core/services/toast-notifier';
import { LiveRoomStore } from '../../features/room/store/live-room-store';
import { RoomsFacade } from '../../features/rooms/store/rooms.facade';
import type { AppView } from '../models/layout.model';
import { InRoomBanner } from '../ui/inroom-banner/inroom-banner';
import { MobileTabbar } from '../ui/mobile-tabbar/mobile-tabbar';
import { Sidebar } from '../ui/sidebar/sidebar';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, MatIconModule, Sidebar, MobileTabbar, InRoomBanner],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  readonly theme = inject(ThemeService);
  readonly pwa = inject(PwaService);
  readonly identity = inject(IdentityStore);
  readonly roomsStore = inject(RoomsFacade);
  readonly roomStore = inject(LiveRoomStore);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly toast = inject(ToastNotifier);
  private readonly router = inject(Router);
  private readonly roomLauncher = inject(RoomLauncher);
  private readonly destroyRef = inject(DestroyRef);

  readonly sidebarCollapsed = signal(false);
  readonly isPhoneViewport = toSignal(
    this.breakpointObserver
      .observe('(max-width: 767px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  readonly activeView = computed<AppView>(() => {
    const finalUrl = this.router.lastSuccessfulNavigation()?.finalUrl;
    const url = finalUrl ? this.router.serializeUrl(finalUrl) : this.router.url;
    const path = (url.split('?')[0] ?? '').split('#')[0] ?? '';
    const seg = path.replace(/^\/+/, '').split('/')[0] ?? '';
    return seg === 'room' || seg === 'people' || seg === 'profile' ? seg : 'rooms';
  });

  constructor() {
    afterNextRender(() => this.roomsStore.ensureLoaded());
    effect(() => {
      if (this.identity.needsOnboarding() && this.activeView() !== 'profile') {
        void this.router.navigate(['/profile']);
      }
    });
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }

  onOpenStartRoom(): void {
    this.roomLauncher.openStartRoom(this.destroyRef);
  }

  onBackToRoom(): void {
    const roomId = this.roomStore.roomId();
    void this.router.navigate(roomId ? ['/room', roomId] : ['/rooms']).then(() => {
      if (roomId && !this.destroyRef.destroyed) {
        this.roomStore.triggerStageFocus();
        this.toast.show('Back in the room.');
      }
    });
  }
}
