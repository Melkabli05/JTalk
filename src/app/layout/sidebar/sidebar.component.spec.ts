import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { MenuItem } from '@openng/optimus-ui/api';
import { SidebarComponent } from './sidebar.component';

const ROOM = {
  title: 'Spanish coffee',
  targetLanguage: 'es',
  nativeLanguage: 'en',
  hostId: 'h-1',
  hostName: 'Hana',
  hostAvatar: '',
  participantCount: 9,
  speakers: 3,
  seats: 6,
};

const command = vi.fn();
const ACCOUNT: MenuItem[] = [
  { label: 'Profile', icon: 'pi pi-user', routerLink: '/profile' },
  { label: 'Dark theme', icon: 'pi pi-moon', command },
  { separator: true },
  { label: 'Sign out', icon: 'pi pi-sign-out', linkClass: 'danger-item', command },
];

const ITEMS: MenuItem[] = [
  { label: 'Rooms', icon: 'pi pi-microphone', routerLink: '/' },
  { label: 'People', icon: 'pi pi-users', routerLink: '/people' },
];

@Component({
  selector: 'app-sidebar-host',
  imports: [SidebarComponent],
  template: `<app-sidebar [items]="items" [accountItems]="[]"
    ><a brand href="/">Jtalk</a></app-sidebar
  >`,
})
class HostComponent {
  protected readonly items = ITEMS;
}

describe('SidebarComponent (presentational)', () => {
  let fixture: ComponentFixture<SidebarComponent>;
  const root = () => fixture.nativeElement as HTMLElement;

  async function render(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(SidebarComponent);
    fixture.componentRef.setInput('items', ITEMS);
    fixture.componentRef.setInput('accountItems', ACCOUNT);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  it('is a complementary landmark with the pages as links, under the brand', async () => {
    await render();

    expect(root().getAttribute('role')).toBe('complementary');
    expect(root().querySelector('nav[aria-label="Primary"] .p-menu-start')).not.toBeNull();
    const links = [...root().querySelectorAll<HTMLAnchorElement>('[role="menuitem"] a')];
    expect(links.map((a) => a.textContent?.trim())).toEqual(['Rooms', 'People']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/', '/people']);
  });

  it('asks to start a room from the Go live card', async () => {
    await render();
    const asked = vi.fn();
    fixture.componentInstance.startRoom.subscribe(asked);

    root().querySelector<HTMLButtonElement>('.go-live button')!.click();

    expect(asked).toHaveBeenCalledOnce();
  });

  it('draws glow waves on the border of the Go live card', async () => {
    await render();

    expect(root().querySelector('.go-live app-live-waves')).not.toBeNull();
  });

  it("puts the card about the room in the Go live card's place while the person is in a room, without the waves", async () => {
    await render({ room: ROOM });

    expect(root().querySelector('app-current-room-card.go-live')).not.toBeNull();
    expect(root().querySelector('app-live-waves')).toBeNull();
    expect(root().textContent).not.toContain('Start a room');
  });

  it('asks to go back to the room from that card', async () => {
    await render({ room: ROOM });
    const back = vi.fn();
    const start = vi.fn();
    fixture.componentInstance.backToRoom.subscribe(back);
    fixture.componentInstance.startRoom.subscribe(start);

    root().querySelector<HTMLButtonElement>('app-current-room-card button')!.click();

    expect(back).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
  });

  it('offers nothing about rooms while the person is looking at the room they are in', async () => {
    await render({ room: ROOM, viewing: true });

    expect(root().querySelector('.go-live')).toBeNull();
    expect(root().textContent).not.toContain('Start a room');
    expect(root().textContent).not.toContain('Back to the room');
    expect(root().querySelector('button.account')).not.toBeNull();
  });

  it('is the Go live card again once the room is left', async () => {
    await render({ room: ROOM });

    fixture.componentRef.setInput('room', null);
    await fixture.whenStable();

    expect(root().querySelector('app-current-room-card')).toBeNull();
    expect(root().querySelector('.go-live app-live-waves')).not.toBeNull();
  });

  describe('the account at the foot', () => {
    const menuLabels = () =>
      [...document.querySelectorAll('.p-menu-overlay .p-menu-item-link')].map((l) =>
        l.textContent?.trim(),
      );

    async function open() {
      root().querySelector<HTMLButtonElement>('button.account')!.click();
      await fixture.whenStable();
      await vi.waitFor(() => expect(menuLabels().length).toBeGreaterThan(0));
    }

    it('is one button with the person and a chevron, named as the account menu', async () => {
      await render({ name: 'Mona Hassan', languages: '🇦🇷 → 🇬🇧' });
      const account = root().querySelector<HTMLButtonElement>('button.account')!;

      expect(account.textContent).toContain('Mona Hassan');
      expect(account.textContent).toContain('🇦🇷 → 🇬🇧');
      expect(account.getAttribute('aria-label')).toBe('Account menu, Mona Hassan');
      expect(account.getAttribute('aria-haspopup')).toBe('menu');
      expect(account.querySelector('.chevron')).not.toBeNull();
    });

    it('opens a menu with the profile, the theme and Sign out, which is set apart at the end', async () => {
      await render({ name: 'Mona Hassan' });
      await open();

      expect(menuLabels()).toEqual(['Profile', 'Dark theme', 'Sign out']);
      expect(document.querySelector('.p-menu-overlay .p-menu-separator')).not.toBeNull();
      expect(
        document
          .querySelector('.p-menu-overlay .p-menu-item-link.danger-item')
          ?.textContent?.trim(),
      ).toBe('Sign out');
    });

    it('does what the shell says an item does', async () => {
      command.mockClear();
      await render({ name: 'Mona Hassan' });
      await open();

      [...document.querySelectorAll<HTMLElement>('.p-menu-overlay .p-menu-item-link')]
        .find((l) => l.textContent?.includes('Sign out'))!
        .click();

      expect(command).toHaveBeenCalledOnce();
    });

    it('draws the picture they chose, their initials without one, and an icon until the name is known', async () => {
      await render({ picture: 'avatars/avatar-06.svg', name: 'Mona Hassan' });
      expect(root().querySelector('button.account img')?.getAttribute('src')).toBe(
        'avatars/avatar-06.svg',
      );

      fixture.componentRef.setInput('picture', null);
      await fixture.whenStable();
      expect(root().querySelector('button.account img')).toBeNull();
      expect(root().querySelector('button.account p-avatar')?.textContent?.trim()).toBe('MH');

      fixture.componentRef.setInput('name', '');
      await fixture.whenStable();
      expect(root().querySelector('button.account .pi-user')).not.toBeNull();
      expect(root().querySelector('button.account')?.textContent).toContain('Your account');
    });
  });

  it('puts the brand it is given at the top of the menu', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const host = TestBed.createComponent(HostComponent);
    await host.whenStable();

    expect(
      (host.nativeElement as HTMLElement).querySelector('.p-menu-start a[brand]')?.textContent,
    ).toBe('Jtalk');
  });
});
