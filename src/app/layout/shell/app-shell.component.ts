import { Component, computed, inject, signal } from '@angular/core';
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
import { AuthService } from '@core/auth/auth.service';
import type { ProfileDraft } from '@core/auth/identity.models';
import { IdentityService } from '@core/auth/identity.service';
import { ProfileDialogComponent } from '@core/auth/ui/profile-dialog/profile-dialog.component';
import { APP_NAME } from '@core/config/app-config';
import { ColorSchemeService } from '@core/config/color-scheme.service';
import { DirectionService } from '@core/config/direction.service';
import { AriaCurrentDirective } from '@shared/directives/aria-current.directive';
import { BrandMarkComponent } from '@shared/ui/brand-mark/brand-mark.component';
import { LocaleService } from '@core/config/locale.service';
import { LocaleSwitchComponent } from '@shared/ui/locale-switch/locale-switch.component';
import { I18n } from '@shared/utils/i18n/i18n.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { msg } from '@shared/utils/i18n/msg';
import { Tooltip } from '@openng/optimus-ui/tooltip';

const NAV_ITEMS: MenuItem[] = [
  {
    label: msg('Rooms'),
    icon: 'pi pi-microphone',
    routerLink: '/',
    routerLinkActiveOptions: { exact: true },
  },
];

/**
 * What the shell reads from the current route: breadcrumbs from `data: { breadcrumb: 'Label' }` (the route's own
 * config, not inherited), and `data: { wide: true }`, which lets a page use the full width of the content area.
 */
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

/**
 * The application chrome, and the one container that owns app-level state (auth, theme, router). Its header,
 * navigation menu and breadcrumb are Optimus components (toolbar, menu, breadcrumb): they do their own routing and
 * mark the active item, so there is no navigation code of ours beyond the items and the breadcrumb trail.
 */
@Component({
  selector: 'app-shell',
  imports: [
    ProfileDialogComponent,
    Tooltip,
    TranslatePipe,
    RouterOutlet,
    RouterLink,
    Menubar,
    Breadcrumb,
    ButtonDirective,
    ProgressBar,
    AriaCurrentDirective,
    BrandMarkComponent,
    LocaleSwitchComponent,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  private readonly router = inject(Router);

  protected readonly auth = inject(AuthService);
  protected readonly identity = inject(IdentityService);
  protected readonly colorScheme = inject(ColorSchemeService);
  protected readonly direction = inject(DirectionService);
  protected readonly locales = inject(LocaleService);
  private readonly i18n = inject(I18n);
  protected readonly appName = APP_NAME;
  protected readonly editingProfile = signal(false);
  protected readonly profileOpen = computed(
    () => this.identity.needsProfile() || this.editingProfile(),
  );
  protected readonly navItems = computed(() => this.translated(NAV_ITEMS));

  /** True while a navigation is in flight (lazy chunk loading, guards): drives the progress bar. */
  protected readonly navigating = computed(() => !!this.router.currentNavigation());

  private readonly route = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => readRoute(this.router.routerState.snapshot.root)),
    ),
    { initialValue: { breadcrumbs: [] as MenuItem[], wide: false } },
  );

  protected readonly breadcrumbs = computed(() => this.translated(this.route().breadcrumbs));
  protected readonly wide = computed(() => this.route().wide);

  private translated(items: readonly MenuItem[]): MenuItem[] {
    return items.map((item) => ({ ...item, label: this.i18n.t(item.label ?? '') }));
  }

  protected saveProfile(draft: ProfileDraft): void {
    this.identity.saveProfile(draft);
    this.editingProfile.set(false);
  }

  protected async signOut(): Promise<void> {
    this.auth.signOut();
    await this.router.navigateByUrl('/');
  }
}
