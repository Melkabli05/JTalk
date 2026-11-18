import { ActiveRoomService } from '@core/rooms/active-room.service';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { type Observable, of } from 'rxjs';
import { fakeAuth0, fakeIdentity } from '@core/auth/auth-testing';
import { ColorSchemeService } from '@core/config/color-scheme.service';
import { DirectionService } from '@core/config/direction.service';
import { I18n } from '@shared/utils/i18n/i18n.service';
import { layoutRoutes } from '../layout.routes';
import { AppShellComponent } from './app-shell.component';

const MONA = { id: 'm-1', name: 'Mona', nativeLanguage: 'ar', learning: 'en', avatar: '' };

/** The HTTP stack, and Auth0's SDK standing in for the browser round trip. */
const httpStack = (logout?: () => Observable<void>) => [
  provideHttpClient(),
  provideHttpClientTesting(),
  fakeAuth0({ logout }),
];

/** What most specs here need besides the router: those, and a person who is already known, so the shell does not wait for the user service. */
const sdk = () => [...httpStack(), fakeIdentity(MONA).provider];

@Component({ selector: 'app-stub', template: '<p>stub page</p>' })
class StubComponent {}

describe('AppShellComponent (container)', () => {
  let fixture: ComponentFixture<AppShellComponent>;
  const root = () => fixture.nativeElement as HTMLElement;

  const settings = () => document.querySelector<HTMLElement>('.settings');
  async function openAccount() {
    root().querySelector<HTMLButtonElement>('header button.account')!.click();
    await vi.waitFor(() => expect(settings()).not.toBeNull());
  }
  const settingsButton = (name: string) =>
    [...(settings()?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.includes(name));
  const toggle = (label: string) =>
    settings()!.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  const localeOption = (name: string) =>
    [...(settings()?.querySelectorAll<HTMLElement>('p-selectbutton [role="button"]') ?? [])].find(
      (option) => option.textContent?.trim() === name,
    );

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
    localStorage.setItem('jtalk:locale', 'en');
    document.documentElement.classList.remove('app-dark');
    TestBed.configureTestingModule({ providers: [...sdk(), provideRouter([])] });
  });

  async function render() {
    fixture = TestBed.createComponent(AppShellComponent);
    await fixture.whenStable();
  }

  it('shows a progress bar only while a navigation is in flight', async () => {
    const released = Promise.withResolvers<void>();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ...sdk(),
        provideRouter([
          { path: '', children: [] },
          { path: 'slow', loadComponent: () => released.promise.then(() => AppShellComponent) },
        ]),
      ],
    });
    await render();
    expect(root().querySelector('p-progressbar')).toBeNull();

    const navigation = TestBed.inject(Router).navigateByUrl('/slow');
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root().querySelector('p-progressbar[aria-label="Loading page"]')).not.toBeNull();
    });

    released.resolve();
    await navigation;
    await fixture.whenStable();
    expect(root().querySelector('p-progressbar')).toBeNull();
  });

  it('shows the app name as a link home, in the header landmark', async () => {
    await render();
    const brand = root().querySelector<HTMLAnchorElement>('header a.brand')!;

    expect(brand.textContent?.trim()).toBe('Jtalk');
    expect(brand.getAttribute('href')).toBe('/');
  });

  it('keeps the banner lean: the brand, the navigation and one account button', async () => {
    await render();

    expect(
      [...root().querySelectorAll('header button')].map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Profile and settings']);
  });

  it('offers sign-out to the signed-in user', async () => {
    await render();
    await openAccount();
    expect(settingsButton('Sign out')).toBeDefined();
  });

  it('switches the color scheme from the dark theme switch', async () => {
    await render();
    await openAccount();
    const scheme = TestBed.inject(ColorSchemeService);
    expect(toggle('Dark theme').checked).toBe(false);

    toggle('Dark theme').click();
    await fixture.whenStable();

    expect(scheme.isDark()).toBe(true);
    expect(toggle('Dark theme').checked).toBe(true);
  });

  it('switches the reading direction from the right-to-left switch', async () => {
    await render();
    await openAccount();
    const direction = TestBed.inject(DirectionService);

    toggle('Right-to-left').click();
    await fixture.whenStable();

    expect(direction.isRtl()).toBe(true);
    expect(document.documentElement.dir).toBe('rtl');
    expect(toggle('Right-to-left').checked).toBe(true);
  });

  it('switches to Arabic from the language switch: its words, its direction, and a way back', async () => {
    await render();
    await openAccount();
    const i18n = TestBed.inject(I18n);

    localeOption('العربية')!.click();
    await vi.waitFor(() => expect(i18n.locale()).toBe('ar'));
    await fixture.whenStable();

    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    const links = [...root().querySelectorAll('nav [role="menuitem"] a')].map((a) =>
      a.textContent?.trim(),
    );
    expect(links).toEqual(['الغرف', 'الأشخاص']);
    expect(root().querySelector('a.skip-link')?.textContent).toContain('تخطَّ');

    localeOption('English')!.click();
    await vi.waitFor(() => expect(i18n.locale()).toBe('en'));
    await fixture.whenStable();
    expect(document.documentElement.dir).toBe('ltr');
    expect(root().querySelector('nav [role="menuitem"] a')?.textContent?.trim()).toBe('Rooms');
  });

  it('has a primary navigation landmark with real links', async () => {
    await render();
    const links = [
      ...root().querySelectorAll<HTMLAnchorElement>(
        'nav[aria-label="Primary"] [role="menuitem"] a',
      ),
    ];

    expect(links.map((a) => a.textContent?.trim())).toEqual(['Rooms', 'People']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/', '/people']);
  });

  it('lets a page ask for the full width of the content area (route data `wide`)', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ...sdk(),
        provideRouter([
          { path: 'wide', data: { wide: true }, children: [] },
          { path: 'narrow', children: [] },
        ]),
      ],
    });
    await render();
    const main = () => root().querySelector('main')!;

    await TestBed.inject(Router).navigateByUrl('/wide');
    await fixture.whenStable();
    expect(main().classList.contains('wide')).toBe(true);

    await TestBed.inject(Router).navigateByUrl('/narrow');
    await fixture.whenStable();
    expect(main().classList.contains('wide')).toBe(false);
  });

  describe('the room the person is still in', () => {
    const badge = () => root().querySelector<HTMLAnchorElement>('a.live-room');

    async function renderWithRoutes() {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          ...sdk(),
          provideRouter([
            { path: 'section', children: [] },
            { path: 'rooms/:id', children: [] },
          ]),
        ],
      });
      await render();
      return TestBed.inject(Router);
    }

    it('offers a way back to it from any other page, and not on its own page', async () => {
      const router = await renderWithRoutes();
      const active = TestBed.inject(ActiveRoomService);
      expect(badge()).toBeNull();

      active.set({ id: 'r-1', title: 'Spanish coffee' });
      await router.navigateByUrl('/section');
      await fixture.whenStable();
      expect(badge()?.textContent).toContain('Spanish coffee');
      expect(badge()?.getAttribute('href')).toBe('/rooms/r-1');
      expect(badge()?.getAttribute('aria-label')).toBe('Back to the room: Spanish coffee');

      await router.navigateByUrl('/rooms/r-1');
      await fixture.whenStable();
      expect(badge()).toBeNull();

      await router.navigateByUrl('/section');
      await fixture.whenStable();
      expect(badge()).not.toBeNull();
    });

    it('is gone once the room is left', async () => {
      const router = await renderWithRoutes();
      const active = TestBed.inject(ActiveRoomService);
      active.set({ id: 'r-1', title: 'Spanish coffee' });
      await router.navigateByUrl('/section');
      await fixture.whenStable();
      expect(badge()).not.toBeNull();

      active.set(null);
      await fixture.whenStable();

      expect(badge()).toBeNull();
    });

    it('is a link in the page, before the account button, that a keyboard reaches', async () => {
      const router = await renderWithRoutes();
      TestBed.inject(ActiveRoomService).set({ id: 'r-1', title: 'Spanish coffee' });
      await router.navigateByUrl('/section');
      await fixture.whenStable();

      const end = root().querySelector('.p-menubar-end')!;
      expect([...end.querySelectorAll('a, button')][0]).toBe(badge());
      expect(badge()?.tabIndex).toBeGreaterThanOrEqual(0);
    });
  });

  it('has a skip link and a focusable main landmark', async () => {
    await render();

    expect(root().querySelector('a.skip-link')?.getAttribute('href')).toBe('#main-content');
    expect(root().querySelector('main#main-content')?.getAttribute('tabindex')).toBe('-1');
  });
});

describe('AppShellComponent routing', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...sdk(),
        provideRouter(
          layoutRoutes([
            { path: '', pathMatch: 'full', component: StubComponent },
            {
              path: 'section',
              data: { breadcrumb: 'Section' },
              children: [
                { path: '', component: StubComponent },
                { path: ':id', data: { breadcrumb: 'Details' }, component: StubComponent },
              ],
            },
          ]),
        ),
      ],
    });
  });

  async function open(url: string) {
    const harness = await RouterTestingHarness.create(url);
    await harness.fixture.whenStable();
    return harness.fixture.nativeElement as HTMLElement;
  }
  const crumbs = (root: HTMLElement) =>
    [...root.querySelectorAll('p-breadcrumb .p-breadcrumb-item-label')].map((l) =>
      l.textContent?.trim(),
    );

  it('builds the breadcrumb trail from route data', async () => {
    expect(crumbs(await open('/section/5'))).toEqual(['Section', 'Details']);
  });

  it('does not repeat a parent crumb for its empty-path child', async () => {
    expect(crumbs(await open('/section'))).toEqual(['Section']);
  });

  it('marks Rooms only on the hallway, not on every page below the root', async () => {
    const harness = await RouterTestingHarness.create('/');
    await harness.fixture.whenStable();
    const root = harness.fixture.nativeElement as HTMLElement;
    const highlighted = () =>
      [...root.querySelectorAll('nav a.p-menubar-item-link-active')].map((a) =>
        a.textContent?.trim(),
      );
    expect(highlighted()).toEqual(['Rooms']);

    await harness.navigateByUrl('/section');
    await harness.fixture.whenStable();
    expect(highlighted()).toEqual([]);
  });

  it('marks Rooms as the current page on the hallway, and nothing elsewhere', async () => {
    const harness = await RouterTestingHarness.create('/');
    await harness.fixture.whenStable();
    const root = harness.fixture.nativeElement as HTMLElement;
    const current = () =>
      [
        ...root.querySelectorAll(
          'nav[aria-label="Primary"] [role="menuitem"] a[aria-current="page"]',
        ),
      ].map((a) => a.textContent?.trim());
    expect(current()).toEqual(['Rooms']);

    await harness.navigateByUrl('/section/5');
    await harness.fixture.whenStable();
    expect(current()).toEqual([]);
  });

  it('navigates, without a page load, when a menu link is clicked', async () => {
    const harness = await RouterTestingHarness.create('/section');
    await harness.fixture.whenStable();
    const root = harness.fixture.nativeElement as HTMLElement;
    const link = [
      ...root.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Primary"] [role="menuitem"] a'),
    ].find((a) => a.textContent?.includes('Rooms'))!;

    link.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/');
  });
});

describe('AppShellComponent profile gate', () => {
  const logout = vi.fn(() => of(undefined));
  let fixture: ComponentFixture<AppShellComponent>;
  let http: HttpTestingController;
  const root = () => fixture.nativeElement as HTMLElement;
  const page = () => document.body;
  const settings = () => document.querySelector<HTMLElement>('.settings');
  async function openAccount() {
    root().querySelector<HTMLButtonElement>('header button.account')!.click();
    await vi.waitFor(() => expect(settings()).not.toBeNull());
  }
  const settingsButton = (name: string) =>
    [...(settings()?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.includes(name));

  const profile = (extra: object = {}) => ({
    id: 'm-1',
    username: 'mona_1a2b3c',
    displayName: 'Mona',
    avatarUrl: null,
    nativeLanguage: 'ar',
    createdAt: '2026-11-18T10:00:00Z',
    ...extra,
  });
  const matrix = {
    userId: 'm-1',
    nativeLanguages: ['ar'],
    learningLanguages: [{ languageCode: 'en', proficiencyLevel: 'BEGINNER' }],
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('jtalk:locale', 'en');
    TestBed.configureTestingModule({
      providers: [...httpStack(logout), provideRouter([{ path: 'profile', children: [] }])],
    });
  });

  /**
   * The user service answers by hand, so the page is never "stable" while a request waits: this lets pending work run without waiting
   * for the app to settle, which it only does once every request has been answered.
   */
  async function settle() {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
    fixture.detectChanges();
  }

  /** Renders the shell for someone Auth0 has signed in; the user service then says who they are, or that it does not know them. */
  async function render(me: object | null) {
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AppShellComponent);
    await settle();
    const request = http.expectOne('/api/v1/users/me');
    if (me === null) {
      request.flush({ status: 404 }, { status: 404, statusText: 'Not Found' });
    } else {
      request.flush(me);
      await settle();
      http.expectOne('/api/v1/users/me/languages').flush(matrix);
    }
    await settle();
  }

  it('asks for a profile before the app can be used, and shows no page behind it', async () => {
    await render(null);

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(page().textContent).toContain('Create your profile');
    });
    expect(root().querySelector('router-outlet')).toBeNull();
  });

  it('creates the profile in the user service once the person fills it in, then lets them in', async () => {
    await render(null);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(page().querySelector('app-profile-form input')).not.toBeNull();
    });
    const name = page().querySelector<HTMLInputElement>('app-profile-form input')!;
    name.value = 'Mona';
    name.dispatchEvent(new Event('input'));
    name.dispatchEvent(new Event('blur'));
    await settle();

    page()
      .querySelector('app-profile-form form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();

    const created = http.expectOne((r) => r.method === 'POST' && r.url === '/api/v1/users/me');
    expect(created.request.body).toEqual({
      username: expect.stringMatching(/^mona_[0-9a-f]{6}$/) as unknown,
      displayName: 'Mona',
      avatarUrl: '/avatars/avatar-01.svg',
      nativeLanguage: 'ar',
    });
    created.flush(profile());
    await settle();
    http
      .expectOne((r) => r.method === 'POST' && r.url === '/api/v1/users/me/languages')
      .flush(null);
    await settle();

    http.expectOne((r) => r.method === 'GET' && r.url === '/api/v1/users/me').flush(profile());
    await settle();
    http.expectOne('/api/v1/users/me/languages').flush(matrix);
    await settle();

    expect(root().querySelector('router-outlet')).not.toBeNull();
    await openAccount();
    expect(settings()?.textContent).toContain('Mona');
  });

  it('shows who the person is in the account popover, straight into the app', async () => {
    await render(profile());

    expect(page().textContent).not.toContain('Create your profile');
    expect(root().querySelector('router-outlet')).not.toBeNull();
    await openAccount();
    expect(settings()?.textContent).toContain('Mona');
  });

  it('shows the picture the person chose on the account button', async () => {
    await render(profile({ avatarUrl: '/avatars/avatar-06.svg' }));

    expect(root().querySelector('header .account img')?.getAttribute('src')).toBe(
      'avatars/avatar-06.svg',
    );
  });

  it('shows a plain icon on the account button of someone with no picture', async () => {
    await render(profile());

    expect(root().querySelector('header .account img')).toBeNull();
    expect(root().querySelector('header .account .pi-user')).not.toBeNull();
  });

  it('signs out through Auth0, which sends the person back to the app', async () => {
    await render(profile());

    await openAccount();
    settingsButton('Sign out')!.click();
    await settle();

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('names the person on the account button, for those with room for it', async () => {
    await render(profile({ displayName: 'Mona Hassan' }));

    expect(root().querySelector('header .account .account-name')?.textContent).toBe('Mona');
  });

  it('links to the profile page from the account popover, and closes the popover', async () => {
    await render(profile());

    await openAccount();
    const link = settings()!.querySelector<HTMLAnchorElement>('a[href="/profile"]')!;
    expect(link.textContent).toContain('Your profile');

    link.click();
    await settle();
    await vi.waitFor(() => expect(settings()).toBeNull());
  });
});
