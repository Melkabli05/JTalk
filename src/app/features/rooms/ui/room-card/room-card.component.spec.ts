import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Tooltip } from '@openng/optimus-ui/tooltip';
import type { Room } from '../../models/room.model';
import { RoomCardComponent } from './room-card.component';
import type { Person } from '@core/auth/identity.models';

const ROOM: Room = {
  id: 'r-1',
  title: 'Spanish for beginners',
  topic: 'Ordering food',
  hostId: 'h-1',
  targetLanguage: 'es',
  nativeLanguage: 'en',
  maxStageSeats: 6,
  speakers: ['h-1', 's-2'],
  participantCount: 5,
  handRaiseCount: 2,
};

const MEMBERS: ReadonlyMap<string, Person> = new Map([
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

    expect(root.querySelector('h2')?.textContent).toContain('Spanish for beginners');
    expect(root.textContent).toContain('Ordering food');
    expect(root.textContent).toContain('Spanish');
    expect(root.textContent).toContain('for English speakers');
  });

  it('names only the host, marked, and shows the others as faces with their names for a tooltip', async () => {
    const { fixture, root } = await render({ ...ROOM, speakers: ['s-2', 'h-1'] });

    expect(root.querySelector('.host .name')?.textContent).toBe('Alice Host');
    expect(root.querySelectorAll('.pi-crown')).toHaveLength(1);
    expect(root.querySelectorAll('.name')).toHaveLength(1);
    expect(root.querySelectorAll('p-avatargroup app-person-avatar')).toHaveLength(1);
    expect(
      fixture.debugElement
        .queryAll(By.directive(Tooltip))
        .map((el) => el.injector.get(Tooltip).content),
    ).toEqual(['Maya Speaker']);
    expect(root.textContent).not.toContain('Hosted by');
  });

  it('keeps every name for screen readers, since the tooltips are for the pointer', async () => {
    const { root } = await render();

    expect(root.querySelector('.speakers')?.textContent).toContain('Maya Speaker');
    expect(root.querySelector('p-avatargroup')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows a few faces and says how many more there are', async () => {
    const speakers = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const { root } = await render({ ...ROOM, hostId: 'a', speakers });

    expect(root.querySelectorAll('p-avatargroup app-person-avatar')).toHaveLength(4);
    expect(root.querySelector('.more')?.textContent).toContain('+2');
  });

  it('says how many are in the room, and how many seats are open, only while there are some', async () => {
    const { root } = await render();
    const counts = root.querySelector('.counts')?.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(counts).toContain('5 in the room');
    expect(counts).toContain('Open seats: 4');

    const full = await render({ ...ROOM, maxStageSeats: 2 });
    expect(full.root.querySelector('.counts')?.textContent).not.toContain('Open seats');
  });

  it('is a labelled group with a real heading whose button is the way in', async () => {
    const { root } = await render();

    const heading = root.querySelector('h2');
    expect(heading?.textContent?.trim()).toBe('Spanish for beginners');
    expect(root.querySelector('p-card')?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(root.querySelectorAll('button')).toHaveLength(1);
    expect(root.querySelector('button')?.getAttribute('aria-label')).toBe(
      'Join Spanish for beginners',
    );
  });

  it('hides the decorative flag from screen readers', async () => {
    const { root } = await render();

    expect(root.querySelector('.flag')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows no topic line when there is none', async () => {
    const { root } = await render({ ...ROOM, topic: '' });

    expect(root.querySelector('.topic')).toBeNull();
  });

  it('asks to open the room from the title button', async () => {
    const { fixture, root } = await render();
    const opened = vi.fn();
    fixture.componentInstance.opened.subscribe(opened);

    root.querySelector('button')!.click();

    expect(opened).toHaveBeenCalledOnce();
  });
});
