import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { type CurrentRoom, CurrentRoomCardComponent } from './current-room-card.component';

const ROOM: CurrentRoom = {
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

describe('CurrentRoomCardComponent (presentational)', () => {
  let fixture: ComponentFixture<CurrentRoomCardComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent?.replace(/\s+/g, ' ') ?? '';

  async function render(room: CurrentRoom = ROOM) {
    fixture = TestBed.createComponent(CurrentRoomCardComponent);
    fixture.componentRef.setInput('room', room);
    await fixture.whenStable();
  }

  it('says the person is in a room, which one, and that it is live', async () => {
    await render();

    expect(text()).toContain('You are in a room');
    expect(text()).toContain('Spanish coffee');
    expect(root().querySelector('p-tag')?.textContent).toContain('Live');
    expect(root().querySelector('p-card')?.getAttribute('aria-label')).toBe('You are in a room');
  });

  it('says what the room is: its languages, its host and how busy it is, and not its description', async () => {
    await render();

    expect(text()).toContain('Spanish');
    expect(text()).toContain('for English speakers');
    expect(root().querySelector('.topic')).toBeNull();
    expect([...root().querySelectorAll('.stat')].map((el) => el.textContent?.trim())).toEqual([
      '9',
      '3/6',
    ]);
    expect(root().querySelector('.counts .cdk-visually-hidden')?.textContent).toContain(
      '9 in the room',
    );
  });

  it('shows the host as a face with their name and the word Host', async () => {
    await render();
    const host = root().querySelector<HTMLElement>('.host')!;

    expect(host.querySelector('.who strong')?.textContent).toBe('Hana');
    expect(host.querySelector('.who small')?.textContent).toBe('Host');
    expect(host.querySelector('p-avatar')?.textContent?.trim()).toBe('H');
  });

  it("draws the host's own picture when they chose one", async () => {
    await render({ ...ROOM, hostAvatar: 'avatar-03' });

    expect(root().querySelector('.host img')?.getAttribute('src')).toBe('avatars/avatar-03.svg');
  });

  it('leaves out the host until their name is known', async () => {
    await render({ ...ROOM, hostName: '' });

    expect(root().querySelector('.host')).toBeNull();
  });

  it('draws no glow waves', async () => {
    await render();

    expect(root().querySelector('app-live-waves')).toBeNull();
  });

  it('asks to go back to the room', async () => {
    await render();
    const back = vi.fn();
    fixture.componentInstance.back.subscribe(back);

    root().querySelector<HTMLButtonElement>('button')!.click();

    expect(back).toHaveBeenCalledOnce();
    expect(root().querySelector('button')?.textContent).toContain('Back to the room');
  });
});
