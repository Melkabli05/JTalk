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
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Menubar } from '@openng/optimus-ui/menubar';
import { ProgressBar } from '@openng/optimus-ui/progressbar';
import { filter, map } from 'rxjs';
import type { ProfileDraft } from '@core/auth/identity.models';
import { IdentityService } from '@core/auth/identity.service';
import { ActiveRoomService } from '@core/rooms/active-room.service';
import { ProfileDialogComponent } from '@core/auth/ui/profile-dialog/profile-dialog.component';
import { APP_NAME } from '@core/config/app-config';
import { ColorSchemeService } from '@core/config/color-scheme.service';
import { DirectionService } from '@core/config/direction.service';
import { avatarUrl } from '@shared/utils/avatars';
import { AriaCurrentDirective } from '@shared/directives/aria-current.directive';
import { BrandMarkComponent } from '@shared/ui/brand-mark/brand-mark.component';
import { LocaleService } from '@core/config/locale.service';
import { FormsModule } from '@angular/forms';
import { Avatar } from '@openng/optimus-ui/avatar';
import { InitialsPipe } from '@shared/pipes/initials.pipe';
import { LocaleSwitchComponent } from '@shared/ui/locale-switch/locale-switch.component';
import { I18n } from '@shared/utils/i18n/i18n.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { msg } from '@shared/utils/i18n/msg';
import { languageOf } from '@shared/utils/languages';
import { Popover } from '@openng/optimus-ui/popover';
import { Tooltip } from '@openng/optimus-ui/tooltip';
import { ToggleSwitch } from '@openng/optimus-ui/toggleswitch';

const NAV_ITEMS: MenuItem[] = [
  {
    label: msg('Rooms'),
    icon: 'pi pi-microphone',
    routerLink: '/',
    routerLinkActiveOptions: { exact: true },
  },
  {
    label: msg('People'),
    icon: 'pi pi-users',
    routerLink: '/people',
  },
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
    Avatar,
    FormsModule,
    InitialsPipe,
    Popover,
    ProfileDialogComponent,
    ToggleSwitch,
    TranslatePipe,
    RouterOutlet,
    RouterLink,
    Menubar,
    Breadcrumb,
    ButtonDirective,
    ProgressBar,
    Tooltip,
    AriaCurrentDirective,
    BrandMarkComponent,
    LocaleSwitchComponent,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  private readonly router = inject(Router);

  protected readonly identity = inject(IdentityService);
  private readonly activeRoom = inject(ActiveRoomService);
  protected readonly colorScheme = inject(ColorSchemeService);
  protected readonly direction = inject(DirectionService);
  protected readonly locales = inject(LocaleService);
  private readonly i18n = inject(I18n);
  protected readonly appName = APP_NAME;
  protected readonly myPicture = computed(() => avatarUrl(this.identity.profile()?.avatar));
  protected readonly firstName = computed(
    () => this.identity.profile()?.name.trim().split(/\s+/)[0] ?? '',
  );
  protected readonly myLanguages = computed(() => {
    const me = this.identity.profile();
    return me ? `${languageOf(me.nativeLanguage).flag} → ${languageOf(me.learning).flag}` : '';
  });
  protected readonly navItems = computed(() => this.translated(NAV_ITEMS));

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
  protected readonly liveRoom = computed(() => {
    const room = this.activeRoom.room();
    return room && !(this.url().split(/[?#]/)[0] ?? '').startsWith(`/rooms/${room.id}`)
      ? room
      : null;
  });

  protected readonly breadcrumbs = computed(() => this.translated(this.route().breadcrumbs));
  protected readonly wide = computed(() => this.route().wide);

  private translated(items: readonly MenuItem[]): MenuItem[] {
    return items.map((item) => ({ ...item, label: this.i18n.t(item.label ?? '') }));
  }

  protected async saveProfile(draft: ProfileDraft): Promise<void> {
    await this.identity.saveProfile(draft);
  }

  protected signOut(): Promise<void> {
    return this.identity.signOut();
  }
}
