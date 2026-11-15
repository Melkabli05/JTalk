import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '@core/auth/auth.service';
import { ColorSchemeService } from '@core/config/color-scheme.service';
import { DirectionService } from '@core/config/direction.service';
import { I18n } from '@shared/utils/i18n/i18n.service';
import { layoutRoutes } from '../layout.routes';
import { AppShellComponent } from './app-shell.component';

@Component({ selector: 'app-stub', template: '<p>stub page</p>' })
class StubComponent {}

describe('AppShellComponent (container)', () => {
  let fixture: ComponentFixture<AppShellComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const button = (name: string) =>
    [...root().querySelectorAll('button')].find(
      (b) => b.textContent?.includes(name) || b.getAttribute('aria-label')?.includes(name),
    );

  const localeOption = (name: string) =>
    [...root().querySelectorAll<HTMLElement>('p-selectbutton [role="button"]')].find(
      (option) => option.textContent?.trim() === name,
    );

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
    localStorage.setItem('jtalk:locale', 'en');
    document.documentElement.classList.remove('app-dark');
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
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

  it('offers no sign-out to a visitor', async () => {
    await render();
    expect(button('Sign out')).toBeUndefined();
  });

  it('offers sign-out to a signed-in user', async () => {
    sessionStorage.setItem('jtalk:token', 'jwt');
    await render();
    expect(button('Sign out')).toBeDefined();
  });

  it('explains the icon-only buttons in a tooltip when the pointer rests on them', async () => {
    await render();

    button('Switch to dark theme')!.dispatchEvent(new MouseEvent('mouseenter'));

    await vi.waitFor(() =>
      expect(document.querySelector('.p-tooltip')?.textContent).toContain('Switch to dark theme'),
    );
  });

  it('switches the color scheme from the theme button, and relabels it', async () => {
    await render();
    const scheme = TestBed.inject(ColorSchemeService);

    button('Switch to dark theme')!.click();
    await fixture.whenStable();

    expect(scheme.isDark()).toBe(true);
    expect(button('Switch to light theme')).toBeDefined();
  });

  it('switches the reading direction from the direction button, and relabels it', async () => {
    await render();
    const direction = TestBed.inject(DirectionService);

    button('Switch to right-to-left layout')!.click();
    await fixture.whenStable();

    expect(direction.isRtl()).toBe(true);
    expect(document.documentElement.dir).toBe('rtl');
    expect(button('Switch to left-to-right layout')).toBeDefined();
  });

  it('switches to Arabic from the language button: its words, its direction, and a way back', async () => {
    await render();
    const i18n = TestBed.inject(I18n);

    localeOption('العربية')!.click();
    await vi.waitFor(() => expect(i18n.locale()).toBe('ar'));
    await fixture.whenStable();

    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    const links = [...root().querySelectorAll('nav [role="menuitem"] a')].map((a) =>
      a.textContent?.trim(),
    );
    expect(links).toEqual(['الرئيسية']);
    expect(root().querySelector('a.skip-link')?.textContent).toContain('تخطَّ');

    localeOption('English')!.click();
    await vi.waitFor(() => expect(i18n.locale()).toBe('en'));
    await fixture.whenStable();
    expect(document.documentElement.dir).toBe('ltr');
    expect(root().querySelector('nav [role="menuitem"] a')?.textContent?.trim()).toBe('Home');
  });

  it('signs out and returns home', async () => {
    sessionStorage.setItem('jtalk:token', 'jwt');
    await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    button('Sign out')!.click();
    await fixture.whenStable();

    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/');
    expect(button('Sign out')).toBeUndefined();
  });

  it('has a primary navigation landmark with real links', async () => {
    await render();
    const links = [
      ...root().querySelectorAll<HTMLAnchorElement>(
        'nav[aria-label="Primary"] [role="menuitem"] a',
      ),
    ];

    expect(links.map((a) => a.textContent?.trim())).toEqual(['Home']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/']);
  });

  it('lets a page ask for the full width of the content area (route data `wide`)', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
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

  it('marks Home only on the home page, not on every page below the root', async () => {
    const harness = await RouterTestingHarness.create('/');
    await harness.fixture.whenStable();
    const root = harness.fixture.nativeElement as HTMLElement;
    const highlighted = () =>
      [...root.querySelectorAll('nav a.p-menubar-item-link-active')].map((a) =>
        a.textContent?.trim(),
      );
    expect(highlighted()).toEqual(['Home']);

    await harness.navigateByUrl('/section');
    await harness.fixture.whenStable();
    expect(highlighted()).toEqual([]);
  });

  it('marks Home as the current page on the home page, and nothing elsewhere', async () => {
    const harness = await RouterTestingHarness.create('/');
    await harness.fixture.whenStable();
    const root = harness.fixture.nativeElement as HTMLElement;
    const current = () =>
      [
        ...root.querySelectorAll(
          'nav[aria-label="Primary"] [role="menuitem"] a[aria-current="page"]',
        ),
      ].map((a) => a.textContent?.trim());
    expect(current()).toEqual(['Home']);

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
    ].find((a) => a.textContent?.includes('Home'))!;

    link.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/');
  });
});
