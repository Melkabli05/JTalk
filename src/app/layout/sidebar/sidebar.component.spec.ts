import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { MenuItem } from '@openng/optimus-ui/api';
import { SidebarComponent } from './sidebar.component';

const ROOM = {
  title: 'Spanish coffee',
  topic: 'Ordering food',
  targetLanguage: 'es',
  nativeLanguage: 'en',
  hostName: 'Hana',
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

  it('draws glow waves on the border of the card, calmer when idle and live while the person is in a room', async () => {
    await render();
    const waves = () => root().querySelector<HTMLElement>('.go-live app-live-waves')!;
    expect(waves()).not.toBeNull();
    expect(waves().classList.contains('live')).toBe(false);

    fixture.componentRef.setInput('room', ROOM);
    await fixture.whenStable();
    expect(waves().classList.contains('live')).toBe(true);
  });

  it('turns the Go live card into the way back while the person is in a room', async () => {
    await render({ room: ROOM });
    const back = vi.fn();
    const start = vi.fn();
    fixture.componentInstance.backToRoom.subscribe(back);
    fixture.componentInstance.startRoom.subscribe(start);
    const card = root().querySelector<HTMLElement>('.go-live')!;

    expect(card.textContent).toContain('You are in a room');
    expect(card.textContent).toContain('Spanish coffee');
    expect(card.querySelector('p-tag')?.textContent).toContain('Live');
    expect(card.textContent).not.toContain('Start a room');
    card.querySelector('button')!.click();

    expect(back).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
  });

  it('says what the room is: its languages, topic, host and how busy it is', async () => {
    await render({ room: ROOM });
    const card = root().querySelector<HTMLElement>('.go-live')!;
    const text = card.textContent?.replace(/\s+/g, ' ') ?? '';

    expect(text).toContain('Spanish');
    expect(text).toContain('for English speakers');
    expect(text).toContain('Ordering food');
    expect(text).toContain('Hosted by Hana');
    expect([...card.querySelectorAll('.stat')].map((el) => el.textContent?.trim())).toEqual([
      '9',
      '3/6',
    ]);
    expect(card.querySelector('.counts .cdk-visually-hidden')?.textContent).toContain(
      '9 in the room',
    );
  });

  it('leaves out the topic and the host when it does not have them', async () => {
    await render({ room: { ...ROOM, topic: '', hostName: '' } });
    const text = root().querySelector('.go-live')?.textContent ?? '';

    expect(text).not.toContain('Hosted by');
    expect(root().querySelector('.go-live .topic')).toBeNull();
  });

  it('shows who is signed in and says where the account was pressed', async () => {
    await render({ name: 'Mona Hassan', languages: '🇦🇷 → 🇬🇧' });
    const pressed = vi.fn();
    fixture.componentInstance.settings.subscribe(pressed);
    const account = root().querySelector<HTMLButtonElement>('button.account')!;

    expect(account.textContent).toContain('Mona Hassan');
    expect(account.textContent).toContain('🇦🇷 → 🇬🇧');
    expect(account.getAttribute('aria-label')).toBe('Profile and settings');
    account.click();
    expect(pressed).toHaveBeenCalledOnce();
    expect(pressed.mock.lastCall?.[0]).toBeInstanceOf(MouseEvent);
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
