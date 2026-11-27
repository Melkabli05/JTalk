import { BreakpointObserver } from '@angular/cdk/layout';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { AppStore } from '../../core/store/app.store';
import { RoomsStore } from '../../features/rooms/store/rooms.store';
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
  readonly app = inject(AppStore);
  readonly roomsStore = inject(RoomsStore);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly isPhoneViewport = toSignal(
    this.breakpointObserver.observe('(max-width: 767px)').pipe(map((state) => state.matches)),
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
      if (this.app.needsOnboarding() && this.activeView() !== 'profile') {
        void this.router.navigate(['/profile']);
      }
    });
  }

  toggleSidebar(): void {
    this.app.toggleSidebar();
  }

  onOpenStartRoom(): void {
    this.app.openStartRoom(this.destroyRef);
  }

  onBackToRoom(): void {
    this.app.backToRoom(this.destroyRef);
  }
}
