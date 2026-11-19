import { ActiveRoomService } from '@core/rooms/active-room.service';
import { RoomStartService } from '@core/rooms/room-start.service';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { type Observable, of } from 'rxjs';
import { fakeAuth0, fakeIdentity } from '@core/auth/auth-testing';
import { ColorSchemeService } from '@core/config/color-scheme.service';
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

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
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

  it('shows the app name as a link home, at the top of the sidebar', async () => {
    await render();
    const brand = root().querySelector<HTMLAnchorElement>('a.brand')!;

    expect(brand.textContent?.trim()).toBe('Jtalk');
    expect(brand.getAttribute('href')).toBe('/');
  });

  it('keeps the account in the sidebar: there is no top bar at all', async () => {
    await render();

    expect(root().querySelector('header.bar')).toBeNull();
    expect(root().querySelector('app-sidebar button.account')).not.toBeNull();
    expect(
      [...root().querySelectorAll('button')].some((b) =>
        b.getAttribute('aria-label')?.startsWith('Account menu'),
      ),
    ).toBe(true);
  });

  describe('the account menu in the sidebar', () => {
    const menuItem = (name: string) =>
      [...document.querySelectorAll<HTMLElement>('.p-menu-overlay .p-menu-item-link')].find((l) =>
        l.textContent?.includes(name),
      );
    async function open() {
      root().querySelector<HTMLButtonElement>('app-sidebar button.account')!.click();
      await vi.waitFor(() => expect(menuItem('Sign out')).toBeDefined());
    }

    it('switches the color scheme, and the item follows', async () => {
      await render();
      const scheme = TestBed.inject(ColorSchemeService);
      await open();

      menuItem('Dark theme')!.click();
      await fixture.whenStable();

      expect(scheme.isDark()).toBe(true);
      await open();
      expect(menuItem('Light theme')).toBeDefined();
    });
  });

  describe('the tabs along the bottom, on a phone', () => {
    const label = (name: string) =>
      [...root().querySelectorAll<HTMLElement>('nav.tabs .p-menubar-item-label')].find(
        (l) => l.textContent?.trim() === name,
      );
    const rootLabels = () =>
      [
        ...root().querySelectorAll('nav.tabs .p-menubar-root-list > li > .p-menubar-item-content'),
      ].map((c) => c.querySelector('.p-menubar-item-label')?.textContent?.trim());

    it('has the brand across the top, and the pages and one More menu along the bottom, with the profile, the dark theme and Sign out inside it', async () => {
      await render();

      expect(root().querySelector('header.brandbar a.brand')?.textContent?.trim()).toBe('Jtalk');
      expect(rootLabels()).toEqual(['Rooms', 'People', 'More']);
      expect(
        [...root().querySelectorAll('nav.tabs .p-menubar-submenu .p-menubar-item-label')].map((l) =>
          l.textContent?.trim(),
        ),
      ).toEqual(['Profile', 'Dark theme', 'Sign out']);
      expect(label('Dark theme')?.closest('li')?.querySelector('.pi-moon')).not.toBeNull();
      expect(label('Sign out')?.closest('li')?.querySelector('.pi-sign-out')).not.toBeNull();
    });

    it('switches the color scheme from the menu, and the icon and the name follow', async () => {
      await render();
      const scheme = TestBed.inject(ColorSchemeService);

      label('Dark theme')!.closest('a')!.click();
      await fixture.whenStable();

      expect(scheme.isDark()).toBe(true);
      expect(label('Light theme')?.closest('li')?.querySelector('.pi-sun')).not.toBeNull();
    });

    it('links to the profile from the menu', async () => {
      await render();

      expect(label('Profile')?.closest('a')?.getAttribute('href')).toBe('/profile');
    });
  });

  it('has a primary navigation landmark with real links', async () => {
    await render();
    const links = [
      ...root().querySelectorAll<HTMLAnchorElement>(
        'app-sidebar nav[aria-label="Primary"] [role="menuitem"] a',
      ),
    ];

    expect(links.map((a) => a.textContent?.trim())).toEqual(['Rooms', 'People', 'Profile']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/', '/people', '/profile']);
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
    const card = () => root().querySelector<HTMLElement>('app-sidebar .go-live')!;
    const back = () => card().querySelector<HTMLButtonElement>('button')!;
    const onThePhone = () =>
      [...root().querySelectorAll<HTMLAnchorElement>('nav.tabs [role="menuitem"] a')].find((a) =>
        a.textContent?.includes('Back to the room'),
      );

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

    it('turns the Go live card into the way back to it on any other page, and offers nothing on its own page', async () => {
      const router = await renderWithRoutes();
      const active = TestBed.inject(ActiveRoomService);
      expect(card().textContent).toContain('Go live');
      expect(back().textContent).toContain('Start a room');

      active.set({
        id: 'r-1',
        title: 'Spanish coffee',
        targetLanguage: 'es',
        nativeLanguage: 'en',
        hostId: 'h-1',
        hostName: 'Hana',
        hostAvatar: '',
        participantCount: 5,
        speakers: 2,
        seats: 6,
      });
      await router.navigateByUrl('/section');
      await fixture.whenStable();
      expect(card().textContent).toContain('You are in a room');
      expect(card().textContent).toContain('Spanish coffee');
      expect(back().textContent).toContain('Back to the room');

      back().click();
      await fixture.whenStable();
      expect(router.url).toBe('/rooms/r-1');
      expect(root().querySelector('app-sidebar .go-live')).toBeNull();
      expect(root().querySelector('app-sidebar')?.textContent).not.toContain('Start a room');

      await router.navigateByUrl('/section');
      await fixture.whenStable();
      expect(back().textContent).toContain('Back to the room');
    });

    it('offers the same way back in the menubar across the top, on a phone', async () => {
      const router = await renderWithRoutes();
      expect(onThePhone()).toBeUndefined();

      TestBed.inject(ActiveRoomService).set({
        id: 'r-1',
        title: 'Spanish coffee',
        targetLanguage: 'es',
        nativeLanguage: 'en',
        hostId: 'h-1',
        hostName: 'Hana',
        hostAvatar: '',
        participantCount: 5,
        speakers: 2,
        seats: 6,
      });
      await router.navigateByUrl('/section');
      await fixture.whenStable();

      expect(onThePhone()?.getAttribute('href')).toBe('/rooms/r-1');
      await router.navigateByUrl('/rooms/r-1');
      await fixture.whenStable();
      expect(onThePhone()).toBeUndefined();
    });

    it("draws no menubar across the top on the room's own page, which has its own header, even before it is joined", async () => {
      const router = await renderWithRoutes();
      await router.navigateByUrl('/section');
      await fixture.whenStable();
      expect(root().querySelector('nav.tabs')).not.toBeNull();

      await router.navigateByUrl('/rooms/r-1');
      await fixture.whenStable();
      expect(root().querySelector('nav.tabs')).toBeNull();
      expect(root().querySelector('header.brandbar')).toBeNull();
      expect(root().querySelector('main')?.classList.contains('with-tabs')).toBe(false);

      await router.navigateByUrl('/section');
      await fixture.whenStable();
      expect(root().querySelector('nav.tabs')).not.toBeNull();
    });

    it('is gone once the room is left', async () => {
      const router = await renderWithRoutes();
      const active = TestBed.inject(ActiveRoomService);
      active.set({
        id: 'r-1',
        title: 'Spanish coffee',
        targetLanguage: 'es',
        nativeLanguage: 'en',
        hostId: 'h-1',
        hostName: 'Hana',
        hostAvatar: '',
        participantCount: 5,
        speakers: 2,
        seats: 6,
      });
      await router.navigateByUrl('/section');
      await fixture.whenStable();
      expect(back().textContent).toContain('Back to the room');

      active.set(null);
      await fixture.whenStable();

      expect(back().textContent).toContain('Start a room');
      expect(onThePhone()).toBeUndefined();
    });
  });

  it('starts a room from the sidebar: asks the hallway, wherever the person is', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ...sdk(),
        provideRouter([
          { path: 'section', children: [] },
          { path: '', children: [] },
        ]),
      ],
    });
    await render();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/section');

    root().querySelector<HTMLButtonElement>('app-sidebar .go-live button')!.click();
    await fixture.whenStable();

    expect(router.url).toBe('/');
    expect(TestBed.inject(RoomStartService).requested()).toBe(true);
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

  it('marks Rooms as the current page on the hallway, and nothing elsewhere', async () => {
    const harness = await RouterTestingHarness.create('/');
    await harness.fixture.whenStable();
    const root = harness.fixture.nativeElement as HTMLElement;
    const current = () =>
      [...root.querySelectorAll('app-sidebar [role="menuitem"] a[aria-current="page"]')].map((a) =>
        a.textContent?.trim(),
      );
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
      ...root.querySelectorAll<HTMLAnchorElement>('app-sidebar [role="menuitem"] a'),
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

  const profile = (extra: object = {}) => ({
    id: 'm-1',
    username: 'mona_1a2b3c',
    displayName: 'Mona',
    avatarUrl: null,
    nativeLanguage: 'ar',
    createdAt: '2026-11-18T10:00:00Z',
    nativeLanguages: ['ar'],
    learningLanguages: [{ languageCode: 'en', proficiencyLevel: 'BEGINNER' }],
    ...extra,
  });

  beforeEach(() => {
    localStorage.clear();
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
    }
    await settle();
  }

  it('asks for a profile before the app can be used, and shows no page behind it', async () => {
    await render(null);

    await vi.waitFor(
      () => {
        fixture.detectChanges();
        expect(page().textContent).toContain('Create your profile');
      },
      { timeout: 5000 },
    );
    expect(root().querySelector('router-outlet')).toBeNull();
  });

  it('creates the profile in the user service once the person fills it in, then lets them in', async () => {
    await render(null);
    await vi.waitFor(
      () => {
        fixture.detectChanges();
        expect(page().querySelector('app-profile-form input')).not.toBeNull();
      },
      { timeout: 5000 },
    );
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
      learningLanguages: [{ languageCode: 'en' }],
    });
    created.flush(profile());
    await settle();
    http.expectNone(() => true); // the answer is the profile: nothing is read back, no second call

    expect(root().querySelector('router-outlet')).not.toBeNull();
    expect(root().querySelector('app-sidebar button.account')?.textContent).toContain('Mona');
  });

  it('says so in the dialog when the profile could not be created, and keeps it open to try again', async () => {
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
    http
      .expectOne((r) => r.method === 'POST' && r.url === '/api/v1/users/me')
      .flush({}, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(
      page().querySelector('app-profile-dialog p-message[role="alert"]')?.textContent,
    ).toContain('Could not save your profile. Please try again.');
    expect(root().querySelector('router-outlet')).toBeNull();
  });

  it('shows the picture the person chose on the account card in the sidebar', async () => {
    await render(profile({ avatarUrl: '/avatars/avatar-06.svg' }));

    expect(root().querySelector('app-sidebar button.account img')?.getAttribute('src')).toBe(
      'avatars/avatar-06.svg',
    );
  });

  it('shows the initials of someone with no picture on the account card in the sidebar', async () => {
    await render(profile());

    expect(root().querySelector('app-sidebar button.account img')).toBeNull();
    expect(root().querySelector('app-sidebar button.account p-avatar')?.textContent?.trim()).toBe(
      'M',
    );
  });

  describe('the account menu', () => {
    const menuItem = (name: string) =>
      [...document.querySelectorAll<HTMLElement>('.p-menu-overlay .p-menu-item-link')].find((l) =>
        l.textContent?.includes(name),
      );
    async function open() {
      root().querySelector<HTMLButtonElement>('app-sidebar button.account')!.click();
      await vi.waitFor(() => expect(menuItem('Sign out')).toBeDefined());
    }

    it('names the person on the sidebar card, and its menu links to their profile', async () => {
      await render(profile({ displayName: 'Mona Hassan' }));
      expect(root().querySelector('app-sidebar button.account')?.textContent).toContain(
        'Mona Hassan',
      );
      await open();

      menuItem('Profile')!.click();
      await settle();

      expect(TestBed.inject(Router).url).toBe('/profile');
    });

    it('signs out through Auth0 from the menu, which sends the person back to the app', async () => {
      await render(profile());
      await open();

      menuItem('Sign out')!.click();
      await settle();

      expect(logout).toHaveBeenCalledTimes(1);
    });
  });
});
