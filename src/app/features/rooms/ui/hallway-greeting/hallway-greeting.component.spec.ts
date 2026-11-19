import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { Room } from '../../models/room.model';
import { HallwayGreetingComponent } from './hallway-greeting.component';

const room = (id: string, over: Partial<Room> = {}): Room => ({
  id,
  title: id,
  topic: '',
  hostId: 'h',
  targetLanguage: 'es',
  nativeLanguage: 'en',
  maxStageSeats: 6,
  speakers: ['h'],
  participantCount: 4,
  handRaiseCount: 0,
  ...over,
});

describe('HallwayGreetingComponent (presentational)', () => {
  let fixture: ComponentFixture<HallwayGreetingComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const suggestions = () =>
    [...root().querySelectorAll('.suggestions button')].map((b) =>
      b.textContent?.replace(/\s+/g, ' ').trim(),
    );

  async function render(inputs: Record<string, unknown>) {
    fixture = TestBed.createComponent(HallwayGreetingComponent);
    fixture.componentRef.setInput('rooms', []);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  it('greets by name at the hour of the day, and without one until the name is known', async () => {
    await render({ name: 'Mona' });
    expect(root().querySelector('h1')?.textContent?.trim()).toMatch(
      /^Good (morning|afternoon|evening), Mona$/,
    );

    fixture.componentRef.setInput('name', '');
    await fixture.whenStable();
    expect(root().querySelector('h1')?.textContent?.trim()).toMatch(
      /^Good (morning|afternoon|evening)$/,
    );
  });

  it('is a region named by its greeting', async () => {
    await render({});

    expect(root().querySelector('p-card')?.getAttribute('aria-labelledby')).toBe('greeting');
    expect(root().querySelector('#greeting')).not.toBeNull();
  });

  it('counts the rooms and the people in them, and says nothing of either when there are none', async () => {
    await render({ rooms: [room('a'), room('b', { participantCount: 6 })] });
    const stats = () =>
      [...root().querySelectorAll('.stats p-tag')].map((t) =>
        t.textContent?.replace(/\s+/g, ' ').trim(),
      );
    expect(stats()).toEqual(['Rooms open: 2', 'People in rooms: 10']);

    fixture.componentRef.setInput('rooms', []);
    await fixture.whenStable();
    expect(root().querySelector('.stats')).toBeNull();
  });

  it('suggests rooms worked out from what the person speaks and learns, in a labelled group', async () => {
    await render({
      rooms: [
        room('Coffee in Spanish'),
        room('Tokyo talk', { targetLanguage: 'ja', participantCount: 30 }),
      ],
      me: { nativeLanguage: 'en', learning: 'es' },
    });

    expect(root().querySelector('.suggestions')?.getAttribute('aria-label')).toBe(
      'Suggested for you',
    );
    expect(suggestions()).toEqual(['For you: Coffee in Spanish', 'Busiest now: Tokyo talk']);
  });

  it('suggests starting a room in the language they learn when nobody is practising it', async () => {
    await render({ rooms: [], me: { nativeLanguage: 'en', learning: 'es' } });

    expect(suggestions()).toEqual(['Start a Spanish room']);
  });

  it('asks to join the room that was chosen, and to start when starting was', async () => {
    await render({
      rooms: [room('Coffee in Spanish')],
      me: { nativeLanguage: 'en', learning: 'ja' },
    });
    const joined = vi.fn();
    const started = vi.fn();
    fixture.componentInstance.join.subscribe(joined);
    fixture.componentInstance.start.subscribe(started);
    const buttons = () => [...root().querySelectorAll<HTMLButtonElement>('.suggestions button')];

    buttons()[0]?.click();
    expect(joined).toHaveBeenCalledWith(expect.objectContaining({ id: 'Coffee in Spanish' }));

    buttons()[1]?.click();
    expect(started).toHaveBeenCalledOnce();
  });

  it('offers the language filter only when there is a choice, and shows the chosen one', async () => {
    await render({ languages: ['es'] });
    expect(root().querySelector('app-language-filter')).toBeNull();

    fixture.componentRef.setInput('languages', ['es', 'fr']);
    await fixture.whenStable();
    expect(root().querySelector('app-language-filter')).not.toBeNull();
  });

  it('carries a Start a room button for phones', async () => {
    await render({});
    const started = vi.fn();
    fixture.componentInstance.start.subscribe(started);

    root().querySelector<HTMLButtonElement>('button.start')!.click();

    expect(started).toHaveBeenCalledOnce();
  });
});
