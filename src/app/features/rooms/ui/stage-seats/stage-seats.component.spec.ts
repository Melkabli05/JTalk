import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { Member } from '../../models/room.model';
import { StageSeatsComponent } from './stage-seats.component';

const MEMBERS: ReadonlyMap<string, Member> = new Map([
  ['h-1', { id: 'h-1', name: 'Alice Host', nativeLanguage: 'es', learning: 'en', avatar: '' }],
  ['s-2', { id: 's-2', name: 'Maya Speaker', nativeLanguage: 'es', learning: 'ja', avatar: '' }],
]);

describe('StageSeatsComponent (presentational)', () => {
  let fixture: ComponentFixture<StageSeatsComponent>;
  const root = () => fixture.nativeElement as HTMLElement;

  async function render(inputs: Record<string, unknown> = {}) {
    fixture = TestBed.createComponent(StageSeatsComponent);
    const all = {
      speakers: ['h-1', 's-2'],
      seats: 4,
      hostId: 'h-1',
      meId: 's-2',
      members: MEMBERS,
      canTakeSeat: true,
      ...inputs,
    };
    for (const [name, value] of Object.entries(all)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  it('shows each speaker, marks the host, and says which one is you', async () => {
    await render();

    const people = [...root().querySelectorAll('.person')];
    expect(people.map((p) => p.getAttribute('aria-label'))).toEqual([
      'Alice Host, Host',
      'Maya Speaker (you), Speaker',
    ]);
    expect(people[0].textContent).toContain('Host');
    expect(people[1].textContent).toContain('You');
  });

  it('hides the visual name and avatar from screen readers, which get one full name instead', async () => {
    await render();

    const person = root().querySelector('.person')!;
    expect(person.querySelector('.name')?.getAttribute('aria-hidden')).toBe('true');
    expect(person.querySelector('app-person-avatar p-avatar')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  it('names each open seat by its number', async () => {
    await render();

    expect(
      [...root().querySelectorAll('.seat')].map((seat) => seat.getAttribute('aria-label')),
    ).toEqual(['Take free seat 3 of 4', 'Take free seat 4 of 4']);
  });

  it('offers one open seat per seat nobody has taken', async () => {
    await render();
    expect(root().querySelectorAll('.seat')).toHaveLength(2);

    await render({ speakers: ['h-1', 's-2'], seats: 2 });
    expect(root().querySelectorAll('.seat')).toHaveLength(0);
  });

  it('lets a listener take an open seat, and not when they may not', async () => {
    await render();
    const taken = vi.fn();
    fixture.componentInstance.seatTaken.subscribe(taken);
    root().querySelector<HTMLButtonElement>('.seat')!.click();
    expect(taken).toHaveBeenCalledOnce();

    await render({ canTakeSeat: false });
    expect([...root().querySelectorAll<HTMLButtonElement>('.seat')].every((b) => b.disabled)).toBe(
      true,
    );
  });

  it('opens a person when they are picked', async () => {
    await render();
    const selected = vi.fn();
    fixture.componentInstance.memberSelected.subscribe(selected);

    root().querySelectorAll<HTMLButtonElement>('.person')[1].click();

    expect(selected).toHaveBeenCalledExactlyOnceWith('s-2');
  });

  it('falls back to the start of the id for someone it has no name for', async () => {
    await render({ speakers: ['1f9d2c0e-aaaa-bbbb'], members: new Map(), seats: 1 });

    expect(root().querySelector('.name')?.textContent).toContain('1f9d2c0e');
  });
});
