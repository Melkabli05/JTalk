import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { Room } from '../../models/room.model';
import { HallwayGreetingComponent } from './hallway-greeting.component';

const room = (id: string, targetLanguage = 'es'): Room => ({
  id,
  title: id,
  topic: '',
  hostId: 'h',
  targetLanguage,
  nativeLanguage: 'en',
  maxStageSeats: 6,
  speakers: ['h'],
  participantCount: 4,
  handRaiseCount: 0,
});

describe('HallwayGreetingComponent (presentational)', () => {
  let fixture: ComponentFixture<HallwayGreetingComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const lead = () => root().querySelector('.lead')?.textContent?.replace(/\s+/g, ' ').trim();
  const startButton = () => root().querySelector<HTMLButtonElement>('button.start')!;

  async function render(inputs: Record<string, unknown> = {}) {
    fixture = TestBed.createComponent(HallwayGreetingComponent);
    fixture.componentRef.setInput('rooms', []);
    fixture.componentRef.setInput('hour', 9);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  it('greets by name, and without one until the name is known', async () => {
    await render({ name: 'Mona' });
    expect(root().querySelector('h1')?.textContent?.trim()).toBe('Good morning, Mona');

    fixture.componentRef.setInput('name', '');
    await fixture.whenStable();
    expect(root().querySelector('h1')?.textContent?.trim()).toBe('Good morning');
  });

  it("follows the person's time of day, and changes when the hour does", async () => {
    const greeting = () => root().querySelector('h1')?.textContent?.trim();
    await render({ name: 'Mona', hour: 7 });
    expect(greeting()).toBe('Good morning, Mona');

    for (const [hour, expected] of [
      [13, 'Good afternoon, Mona'],
      [19, 'Good evening, Mona'],
      [23, 'Hello, Mona'],
      [3, 'Hello, Mona'],
      [5, 'Good morning, Mona'],
    ] as const) {
      fixture.componentRef.setInput('hour', hour);
      await fixture.whenStable();
      expect(greeting(), `at ${hour}:00`).toBe(expected);
    }
  });

  it('is a region named by its greeting', async () => {
    await render();

    expect(root().querySelector('p-card')?.getAttribute('aria-labelledby')).toBe('greeting');
    expect(root().querySelector('#greeting')).not.toBeNull();
  });

  it('has a photograph behind the words, hidden from screen readers, and no image to describe', async () => {
    await render();
    const photo = root().querySelector('.photo')!;

    expect(photo.getAttribute('aria-hidden')).toBe('true');
    expect(root().querySelector('img')).toBeNull();
  });

  it('shows the photograph for the hour, a new one every two hours', async () => {
    const photo = () => root().querySelector<HTMLElement>('.photo')?.style.backgroundImage ?? '';
    await render({ hour: 9 });
    expect(photo()).toContain('banners/sky-4.jpg');

    for (const [hour, file] of [
      [0, 'sky-0'],
      [7, 'sky-3'],
      [13, 'sky-6'],
      [19, 'sky-9'],
      [23, 'sky-11'],
    ] as const) {
      fixture.componentRef.setInput('hour', hour);
      await fixture.whenStable();
      expect(photo(), `at ${hour}:00`).toContain(`banners/${file}.jpg`);
    }
  });

  it('keeps the same photograph through the two hours and changes it on the hour', async () => {
    const photo = () => root().querySelector<HTMLElement>('.photo')?.style.backgroundImage;
    await render({ hour: 10 });
    const morning = photo();

    fixture.componentRef.setInput('hour', 11);
    await fixture.whenStable();
    expect(photo()).toBe(morning);

    fixture.componentRef.setInput('hour', 12);
    await fixture.whenStable();
    expect(photo()).not.toBe(morning);
  });

  it('puts light words on the dark photographs of the night and dark words on the days', async () => {
    const dark = () => root().querySelector('.hero')?.classList.contains('dark');
    await render({ hour: 12 });
    expect(dark()).toBe(false);

    fixture.componentRef.setInput('hour', 22);
    await fixture.whenStable();
    expect(dark()).toBe(true);
  });

  it('says how many open rooms are practising what the person learns', async () => {
    await render({
      rooms: [room('a'), room('b', 'fr'), room('c')],
      learning: 'es',
    });

    expect(lead()).toBe('Rooms practising Spanish: 2');
    expect(startButton().textContent).toContain('Start a room');
    expect(startButton().classList.contains('always')).toBe(false);
  });

  it('says they could be the first, and offers to start one in that language, when nobody practises it', async () => {
    await render({ rooms: [room('a', 'fr')], learning: 'ja' });

    expect(lead()).toBe('Nobody is practising Japanese yet. Be the first.');
    expect(startButton().textContent).toContain('Start a Japanese room');
    expect(startButton().classList.contains('always')).toBe(true);
  });

  it('follows the rooms as they come and go', async () => {
    await render({ rooms: [], learning: 'es' });
    expect(lead()).toContain('Be the first');

    fixture.componentRef.setInput('rooms', [room('a')]);
    await fixture.whenStable();
    expect(lead()).toBe('Rooms practising Spanish: 1');
  });

  it('keeps to the plain line until it is known what the person learns', async () => {
    await render({ rooms: [room('a')], learning: '' });

    expect(lead()).toBe('Join a conversation to practise a language.');
  });

  it('does not offer to start a room while the person is in one already', async () => {
    await render({ rooms: [], learning: 'es', canStart: false });

    expect(root().querySelector('button.start')).toBeNull();
    expect(root().textContent).toContain('Nobody is practising Spanish yet');
  });

  it('asks to start a room', async () => {
    await render();
    const started = vi.fn();
    fixture.componentInstance.start.subscribe(started);

    startButton().click();

    expect(started).toHaveBeenCalledOnce();
  });
});
