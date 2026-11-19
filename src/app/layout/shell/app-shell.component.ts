import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { MenuItem } from '@openng/optimus-ui/api';
import { Breadcrumb } from '@openng/optimus-ui/breadcrumb';
import { Menubar } from '@openng/optimus-ui/menubar';
import { ProgressBar } from '@openng/optimus-ui/progressbar';
import { filter, map } from 'rxjs';
import type { ProfileDraft } from '@core/auth/identity.models';
import { IdentityService } from '@core/auth/identity.service';
import { ColorSchemeService } from '@core/config/color-scheme.service';
import { ActiveRoomService } from '@core/rooms/active-room.service';
import { RoomStartService } from '@core/rooms/room-start.service';
import { ProfileDialogComponent } from '@core/auth/ui/profile-dialog/profile-dialog.component';
import { APP_NAME } from '@core/config/app-config';
import { avatarUrl } from '@shared/utils/avatars';
import { AriaCurrentDirective } from '@shared/directives/aria-current.directive';
import { BrandMarkComponent } from '@shared/ui/brand-mark/brand-mark.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { languageOf } from '@shared/utils/languages';
import { saveRequest } from '@shared/utils/save-request';

const PROFILE_ITEM: MenuItem = { label: 'Profile', icon: 'pi pi-user', routerLink: '/profile' };

const NAV_ITEMS: MenuItem[] = [
  {
    label: 'Rooms',
    icon: 'pi pi-microphone',
    routerLink: '/',
    routerLinkActiveOptions: { exact: true },
  },
  { label: 'People', icon: 'pi pi-users', routerLink: '/people' },
  PROFILE_ITEM,
];

function readRoute(root: ActivatedRouteSnapshot): { breadcrumbs: MenuItem[]; wide: boolean } {
  const breadcrumbs: MenuItem[] = [];
  let wide = false;
  let url = '';
  for (let route: ActivatedRouteSnapshot | null = root; route; route = route.firstChild) {
    const segment = route.url.map((part) => part.path).join('/');
    if (segment) {
      url += `/${segment}`;
    }
    const label: unknown = route.routeConfig?.data?.['breadcrumb'];
    if (typeof label === 'string') {
      breadcrumbs.push({ label, routerLink: url || '/' });
    }
    wide ||= route.routeConfig?.data?.['wide'] === true;
  }
  return { breadcrumbs, wide };
}

@Component({
  selector: 'app-shell',
  imports: [
    Menubar,
    ProfileDialogComponent,
    RouterOutlet,
    RouterLink,
    Breadcrumb,
    ProgressBar,
    AriaCurrentDirective,
    BrandMarkComponent,
    NgTemplateOutlet,
    SidebarComponent,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  private readonly router = inject(Router);

  protected readonly identity = inject(IdentityService);
  private readonly activeRoom = inject(ActiveRoomService);
  protected readonly colorScheme = inject(ColorSchemeService);
  private readonly roomStart = inject(RoomStartService);
  protected readonly appName = APP_NAME;
  protected readonly creating = saveRequest();
  protected readonly myPicture = computed(() => avatarUrl(this.identity.profile()?.avatar));
  protected readonly firstName = computed(
    () => this.identity.profile()?.name.trim().split(/\s+/)[0] ?? '',
  );
  protected readonly myLanguages = computed(() => {
    const me = this.identity.profile();
    return me ? `${languageOf(me.nativeLanguage).flag} → ${languageOf(me.learning).flag}` : '';
  });
  protected readonly navItems = NAV_ITEMS;
  /** The account menu, at the foot of the sidebar and as the More menu across the top of a phone. */
  protected readonly accountItems = computed<MenuItem[]>(() => {
    const dark = this.colorScheme.isDark();
    return [
      PROFILE_ITEM,
      {
        label: dark ? 'Light theme' : 'Dark theme',
        icon: dark ? 'pi pi-sun' : 'pi pi-moon',
        command: () => this.colorScheme.toggle(),
      },
      { separator: true },
      {
        label: 'Sign out',
        icon: 'pi pi-sign-out',
        linkClass: 'danger-item',
        command: () => void this.identity.signOut(),
      },
    ];
  });
  // Across the top (a phone) the pages are icons, with their names kept for screen readers, and the account menu is the last of them;
  // the way back to a room you are in stands out in Forest.
  protected readonly topItems = computed<MenuItem[]>(() => {
    const live = this.liveRoom();
    return [
      ...(live
        ? [
            {
              label: 'Back to the room',
              icon: 'pi pi-headphones',
              linkClass: 'live-item',
              routerLink: ['/rooms', live.id],
            },
          ]
        : []),
      ...this.navItems.filter((item) => item !== PROFILE_ITEM),
      { label: 'More', icon: 'pi pi-ellipsis-v', items: this.accountItems() },
    ];
  });

  protected readonly navigating = computed(() => !!this.router.currentNavigation());

  private readonly route = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => readRoute(this.router.routerState.snapshot.root)),
    ),
    { initialValue: { breadcrumbs: [] as MenuItem[], wide: false } },
  );

  /** Where the person is now, so the way back to the room is not offered on the room's own page. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** The room they are in, while they are somewhere else: the header offers a way back to it. */
  protected readonly inRoom = this.activeRoom.room;
  /** On a room's own page, which has its own header: from the first moment, before the room has been joined. */
  protected readonly onRoomAddress = computed(() =>
    (this.url().split(/[?#]/)[0] ?? '').startsWith('/rooms/'),
  );
  protected readonly onRoomPage = computed(() => {
    const room = this.inRoom();
    return !!room && (this.url().split(/[?#]/)[0] ?? '').startsWith(`/rooms/${room.id}`);
  });
  protected readonly liveRoom = computed(() => (this.onRoomPage() ? null : this.inRoom()));

  protected readonly breadcrumbs = computed(() => this.route().breadcrumbs);
  protected readonly wide = computed(() => this.route().wide);

  protected backToRoom(): void {
    const live = this.liveRoom();
    if (live) {
      void this.router.navigate(['/rooms', live.id]);
    }
  }

  protected startRoom(): void {
    this.roomStart.request();
    void this.router.navigate(['/']);
  }

  protected saveProfile(draft: ProfileDraft): void {
    this.creating.run(this.identity.saveProfile(draft), {
      next: () => undefined,
      failure: 'Could not save your profile. Please try again.',
    });
  }
}
