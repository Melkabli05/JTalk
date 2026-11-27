import { computed, DestroyRef, inject, Service, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { ColorScheme, ThemePreference } from '../models/theme.model';
import { IdentityStore } from '../auth/identity';
import { PwaService } from '../services/pwa';
import { RoomLauncher } from '../services/room-launcher';
import { ThemeService } from '../services/theme';
import { ToastNotifier } from '../services/toast-notifier';
import { LiveRoomStore } from '../../features/room/store/live-room-store';

export type ActiveRoomRole = 'host' | 'speaker' | 'listener';

/**
 * Global application state store: composes identity, theme, connectivity,
 * active room summary, and shell layout state using Angular Signals.
 */
@Service()
export class AppStore {
  private readonly identity = inject(IdentityStore);
  private readonly roomStore = inject(LiveRoomStore);
  private readonly theme = inject(ThemeService);
  private readonly pwa = inject(PwaService);
  private readonly roomLauncher = inject(RoomLauncher);
  private readonly toast = inject(ToastNotifier);
  private readonly router = inject(Router);

  // ---- Layout UI state ----------------------------------------------------
  private readonly sidebarCollapsedState = signal(false);
  readonly sidebarCollapsed = this.sidebarCollapsedState.asReadonly();

  // ---- Identity & Profile -------------------------------------------------
  readonly isAuthenticated = this.identity.isAuthenticated;
  readonly isAuthLoading = this.identity.isLoading;
  readonly authUser = this.identity.authUser;
  readonly userId = this.identity.userId;
  readonly me = this.identity.me;
  readonly displayNameFallback = this.identity.displayNameFallback;
  readonly socialStats = this.identity.socialStats;
  readonly userDirectory = this.identity.userDirectory;
  readonly profileStatus = this.identity.profileStatus;
  readonly profileError = this.identity.profileError;
  readonly hasProfile = this.identity.hasProfile;
  readonly needsOnboarding = this.identity.needsOnboarding;
  readonly meRetrying = this.identity.meRetrying;
  readonly savingProfile = this.identity.savingProfile;
  readonly deletingAccount = this.identity.deletingAccount;

  // ---- Theme & Connectivity -----------------------------------------------
  readonly colorScheme = this.theme.colorScheme;
  readonly themePreference = this.theme.preference;
  readonly isDark = this.theme.isDark;
  readonly isOnline = this.pwa.isOnline;
  readonly canInstall = this.pwa.canInstall;
  readonly isIosInstallable = this.pwa.isIosInstallable;

  // ---- Active Room Summary ------------------------------------------------
  readonly activeRoomId = this.roomStore.roomId;
  readonly activeRoom = this.roomStore.room;
  readonly inRoom = computed(() => this.activeRoom() !== null);
  readonly activeRoomTitle = computed(() => this.activeRoom()?.title ?? 'Live room');
  readonly activeRoomLang = this.roomStore.practiseLangLabel;
  readonly activeRoomSeats = computed(() => this.activeRoom()?.maxStageSeats ?? 8);
  readonly activeRoomRole = computed<ActiveRoomRole>(() =>
    this.roomStore.stage.isHost()
      ? 'host'
      : this.roomStore.stage.isCurrentUserOnStage()
        ? 'speaker'
        : 'listener',
  );
  readonly activeRoomHost = computed(
    () => this.roomStore.stage.speakers().find((s) => s.role === 'host') ?? null,
  );
  readonly activeRoomHostName = computed(
    () =>
      this.activeRoomHost()?.name ??
      this.activeRoom()?.host?.displayName ??
      this.displayNameFallback(),
  );
  readonly activeRoomHostAvatarUrl = computed(
    () =>
      this.activeRoomHost()?.avatarUrl ??
      this.activeRoom()?.host?.avatarUrl ??
      (this.roomStore.stage.isHost() ? (this.me()?.avatarUrl ?? null) : null),
  );

  // ---- Actions ------------------------------------------------------------
  toggleSidebar(): void {
    this.sidebarCollapsedState.update((collapsed) => !collapsed);
  }

  setSidebarCollapsed(collapsed: boolean): void {
    this.sidebarCollapsedState.set(collapsed);
  }

  toggleTheme(): void {
    this.theme.toggle();
  }

  setThemePreference(preference: ThemePreference): void {
    this.theme.setPreference(preference);
  }

  setColorScheme(scheme: ColorScheme): void {
    this.theme.setPreference(scheme);
  }

  openStartRoom(destroyRef: DestroyRef): void {
    this.roomLauncher.openStartRoom(destroyRef);
  }

  backToRoom(destroyRef: DestroyRef): void {
    const roomId = this.activeRoomId();
    void this.router.navigate(roomId ? ['/room', roomId] : ['/rooms']).then(() => {
      if (roomId && !destroyRef.destroyed) {
        this.roomStore.triggerStageFocus();
        this.toast.show('Back in the room.');
      }
    });
  }

  loadMe(): void {
    this.identity.loadMe();
  }

  refreshSocialStats(): void {
    this.identity.refreshSocialStats();
  }

  signOut(): void {
    this.roomStore.signOut();
  }
}
