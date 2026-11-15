import { TestBed } from '@angular/core/testing';
import type { Member, Room } from '../../models/room.model';
import { RoomCardComponent } from './room-card.component';

const ROOM: Room = {
  id: 'r-1',
  title: 'Spanish for beginners',
  topic: 'Ordering food',
  hostId: 'h-1',
  targetLanguage: 'es',
  nativeLanguage: 'en',
  maxStageSeats: 6,
  createdAt: new Date('2026-11-14T10:00:00Z'),
  speakers: ['h-1', 's-2'],
  participantCount: 5,
  handRaiseCount: 2,
};

const MEMBERS: ReadonlyMap<string, Member> = new Map([
  ['h-1', { id: 'h-1', name: 'Alice Host', nativeLanguage: 'es', learning: 'en', avatar: '' }],
  ['s-2', { id: 's-2', name: 'Maya Speaker', nativeLanguage: 'es', learning: 'ja', avatar: '' }],
]);

describe('RoomCardComponent (presentational)', () => {
  async function render(room: Room = ROOM) {
    const fixture = TestBed.createComponent(RoomCardComponent);
    fixture.componentRef.setInput('room', room);
    fixture.componentRef.setInput('members', MEMBERS);
    await fixture.whenStable();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('shows what the room is: title, topic, the language practised and who it is for', async () => {
    const { root } = await render();

    expect(root.querySelector('.p-card-title, [class*="card-title"]')?.textContent).toContain(
      'Spanish for beginners',
    );
    expect(root.textContent).toContain('Ordering food');
    expect(root.textContent).toContain('Spanish');
    expect(root.textContent).toContain('for English speakers');
  });

  it('names the host and shows the speakers by their initials', async () => {
    const { root } = await render();

    expect(root.textContent).toContain('Hosted by Alice Host');
    expect([...root.querySelectorAll('p-avatar')].map((a) => a.textContent?.trim())).toEqual([
      'AH',
      'MS',
    ]);
  });

  it('collapses a long speaker list into a +n avatar', async () => {
    const speakers = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const { root } = await render({ ...ROOM, speakers });

    const avatars = [...root.querySelectorAll('p-avatar')].map((a) => a.textContent?.trim());
    expect(avatars).toHaveLength(6);
    expect(avatars.at(-1)).toBe('+2');
  });

  it('counts seats taken, people in the room, and raised hands only when there are some', async () => {
    const { root } = await render();
    const counts = root.querySelector('.counts')?.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(counts).toContain('On stage: 2/6');
    expect(counts).toContain('In the room: 5');
    expect(counts).toContain('Raised hands: 2');

    const quiet = await render({ ...ROOM, handRaiseCount: 0 });
    expect(quiet.root.querySelectorAll('.counts li')).toHaveLength(2);
  });

  it('is a labelled group with a real heading, and a Join button that names its room', async () => {
    const { root } = await render();

    const heading = root.querySelector('h2');
    expect(heading?.textContent).toBe('Spanish for beginners');
    expect(root.querySelector('p-card')?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(root.querySelector('button')?.getAttribute('aria-label')).toBe(
      'Join Spanish for beginners',
    );
  });

  it('hides the decorative avatars and flag from screen readers', async () => {
    const { root } = await render();

    expect(root.querySelector('p-avatargroup')?.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('.flag')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows no topic line when there is none', async () => {
    const { root } = await render({ ...ROOM, topic: '' });

    expect(root.querySelector('.topic')).toBeNull();
  });

  it('asks to open the room from the Join button', async () => {
    const { fixture, root } = await render();
    const opened = vi.fn();
    fixture.componentInstance.opened.subscribe(opened);

    [...root.querySelectorAll('button')].find((b) => b.textContent?.includes('Join'))!.click();

    expect(opened).toHaveBeenCalledOnce();
  });
});
