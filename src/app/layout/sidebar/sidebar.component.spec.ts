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

const ITEMS: MenuItem[] = [
  { label: 'Rooms', icon: 'pi pi-microphone', routerLink: '/' },
  { label: 'People', icon: 'pi pi-users', routerLink: '/people' },
];

@Component({
  selector: 'app-sidebar-host',
  imports: [SidebarComponent],
  template: `<app-sidebar [items]="items"><a brand href="/">Jtalk</a></app-sidebar>`,
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

  it('shows who is signed in and asks for their profile when the account is pressed', async () => {
    await render({ name: 'Mona Hassan', languages: '🇦🇷 → 🇬🇧' });
    const pressed = vi.fn();
    fixture.componentInstance.profile.subscribe(pressed);
    const account = root().querySelector<HTMLButtonElement>('button.account')!;

    expect(account.textContent).toContain('Mona Hassan');
    expect(account.textContent).toContain('🇦🇷 → 🇬🇧');
    expect(account.getAttribute('aria-label')).toBe('Profile and settings');
    account.click();
    expect(pressed).toHaveBeenCalledOnce();
  });

  it('draws the picture they chose, or a plain icon when there is none', async () => {
    await render({ picture: 'avatars/avatar-06.svg' });
    expect(root().querySelector('button.account img')?.getAttribute('src')).toBe(
      'avatars/avatar-06.svg',
    );

    fixture.componentRef.setInput('picture', null);
    await fixture.whenStable();
    expect(root().querySelector('button.account img')).toBeNull();
    expect(root().querySelector('button.account .pi-user')).not.toBeNull();
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
