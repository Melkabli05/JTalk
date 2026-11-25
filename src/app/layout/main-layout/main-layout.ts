import { BreakpointObserver } from '@angular/cdk/layout';
import { afterNextRender, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { IdentityStore } from '../../core/auth/identity';
import { RoomLauncher } from '../../core/services/room-launcher';
import { ToastNotifier } from '../../core/services/toast-notifier';
import { AppState } from '../../core/state/app-state';
import { LiveRoomStore } from '../../features/room/store/live-room-store';
import { RoomsStore } from '../../features/rooms/store/rooms-store';
import { InRoomBanner } from '../ui/inroom-banner/inroom-banner';
import { MobileTabbar } from '../ui/mobile-tabbar/mobile-tabbar';
import { Sidebar } from '../ui/sidebar/sidebar';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Sidebar, MobileTabbar, InRoomBanner],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  readonly appState = inject(AppState);
  readonly roomsStore = inject(RoomsStore);
  readonly roomStore = inject(LiveRoomStore);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly identity = inject(IdentityStore);
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

  constructor() {
    afterNextRender(() => this.roomsStore.ensureLoaded());
    effect(() => {
      if (this.identity.needsOnboarding() && this.appState.activeView() !== 'profile') {
        this.appState.requestProfileTab('edit');
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

  onOpenProfileOverview(): void {
    this.appState.requestProfileTab('overview');
  }

  async onBackToRoom(): Promise<void> {
    const roomId = this.roomStore.roomId();
    await this.router.navigate(roomId ? ['/room', roomId] : ['/rooms']);
    if (roomId && !this.destroyRef.destroyed) {
      this.appState.triggerStageFocus();
      this.toast.show('Back in the room.');
    }
  }
}
