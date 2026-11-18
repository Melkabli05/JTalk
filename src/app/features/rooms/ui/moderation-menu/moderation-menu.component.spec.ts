import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { MenuItem } from '@openng/optimus-ui/api';
import { ModerationMenuComponent } from './moderation-menu.component';

const mute = vi.fn();
const remove = vi.fn();
const picked = vi.fn();

@Component({
  imports: [ModerationMenuComponent],
  template: `
    <app-moderation-menu name="Maya" [items]="items()">
      <button type="button" class="tile" (click)="picked()">Maya</button>
    </app-moderation-menu>
  `,
})
class SeatComponent {
  readonly items = signal<MenuItem[]>([
    { label: 'Mute', command: mute },
    { label: 'Remove from the room', linkClass: 'danger-item', command: remove },
  ]);
  readonly picked = picked;
}

function pointer(type: string, pointerType: string, at = { x: 0, y: 0 }): Event {
  return Object.assign(
    new Event(type, { bubbles: type !== 'pointerenter' && type !== 'pointerleave' }),
    {
      pointerType,
      clientX: at.x,
      clientY: at.y,
    },
  );
}

describe('ModerationMenuComponent (presentational)', () => {
  let fixture: ComponentFixture<SeatComponent>;
  const host = () => (fixture.nativeElement as HTMLElement).querySelector('app-moderation-menu')!;
  const wrapper = () => host().querySelector<HTMLElement>('.moderated')!;
  const seat = () => host().querySelector<HTMLButtonElement>('button')!;
  const labels = () =>
    [...document.querySelectorAll('.p-menu-item-link')].map((link) => link.textContent?.trim());
  const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms);
  // Fake timers stand in for the real ones, so Angular is driven by hand rather than waited for.
  const settle = async () => {
    fixture.detectChanges();
    await wait(0);
    fixture.detectChanges();
    await wait(0);
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    mute.mockClear();
    remove.mockClear();
    picked.mockClear();
    fixture = TestBed.createComponent(SeatComponent);
    await settle();
  });

  afterEach(() => {
    vi.useRealTimers();
    fixture.destroy();
  });

  it('adds nothing of its own: the seat is still the seat, with no button beside it', () => {
    expect(host().querySelectorAll('button')).toHaveLength(1);
    expect(getComputedStyle(host()).display).toBe('contents');
    expect(getComputedStyle(wrapper()).display).toBe('contents');
  });

  it('opens the menu under the seat once the pointer has rested on it', async () => {
    wrapper().dispatchEvent(pointer('pointerenter', 'mouse'));
    await wait(340);
    await settle();
    expect(labels()).toEqual([]);

    await wait(20);
    await settle();
    expect(labels()).toEqual(['Mute', 'Remove from the room']);
    expect(document.querySelector('.p-menu-item-link.danger-item')?.textContent).toContain(
      'Remove from the room',
    );
  });

  it('does not open for a pointer that only passes over', async () => {
    wrapper().dispatchEvent(pointer('pointerenter', 'mouse'));
    await wait(200);
    wrapper().dispatchEvent(pointer('pointerleave', 'mouse'));
    await wait(1000);
    await settle();

    expect(labels()).toEqual([]);
  });

  it('runs the action that is chosen', async () => {
    wrapper().dispatchEvent(pointer('pointerenter', 'mouse'));
    await wait(400);
    await settle();

    document.querySelector<HTMLElement>('.p-menu-item-link')!.click();

    expect(mute).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();
  });

  it('does not open on hover for a finger, which has none', async () => {
    wrapper().dispatchEvent(pointer('pointerenter', 'touch'));
    await wait(1000);
    await settle();

    expect(labels()).toEqual([]);
  });

  it('opens on a long press, and the finger lifting then does not also open the person', async () => {
    seat().dispatchEvent(pointer('pointerdown', 'touch'));
    await wait(520);
    await settle();
    expect(labels()).toEqual(['Mute', 'Remove from the room']);

    seat().dispatchEvent(pointer('pointerup', 'touch'));
    const lift = new Event('touchend', { bubbles: true, cancelable: true });
    seat().dispatchEvent(lift);
    expect(lift.defaultPrevented).toBe(true);
  });

  it('leaves a short tap to the seat', async () => {
    seat().dispatchEvent(pointer('pointerdown', 'touch'));
    await wait(120);
    seat().dispatchEvent(pointer('pointerup', 'touch'));
    const lift = new Event('touchend', { bubbles: true, cancelable: true });
    seat().dispatchEvent(lift);
    seat().click();
    expect(lift.defaultPrevented).toBe(false);
    await wait(1000);
    await settle();

    expect(picked).toHaveBeenCalledOnce();
    expect(labels()).toEqual([]);
  });

  it('gives up on a press that turns into a scroll', async () => {
    seat().dispatchEvent(pointer('pointerdown', 'touch', { x: 10, y: 10 }));
    await wait(200);
    seat().dispatchEvent(pointer('pointermove', 'touch', { x: 10, y: 60 }));
    await wait(1000);
    await settle();

    expect(labels()).toEqual([]);
  });

  it('opens at once on a right click or the menu key, without the browser menu', async () => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    seat().dispatchEvent(event);
    await settle();

    expect(event.defaultPrevented).toBe(true);
    expect(labels()).toEqual(['Mute', 'Remove from the room']);
  });

  it('closes a moment after the pointer leaves the seat and the menu', async () => {
    wrapper().dispatchEvent(pointer('pointerenter', 'mouse'));
    await wait(400);
    await settle();
    expect(labels()).toHaveLength(2);

    wrapper().dispatchEvent(pointer('pointerleave', 'mouse'));
    await wait(200);
    expect(labels()).toHaveLength(2);

    await wait(200);
    await settle();
    await wait(500);
    expect(labels()).toEqual([]);
  });

  it('stays open while the pointer is on the menu itself', async () => {
    wrapper().dispatchEvent(pointer('pointerenter', 'mouse'));
    await wait(400);
    await settle();
    const overlay = document.querySelector('.p-menu-overlay')!;

    wrapper().dispatchEvent(pointer('pointerleave', 'mouse'));
    overlay.dispatchEvent(pointer('pointerenter', 'mouse'));
    await wait(1000);
    await settle();

    expect(labels()).toHaveLength(2);
  });

  it('does nothing for a seat the host has no actions for', async () => {
    fixture.componentInstance.items.set([]);
    await settle();

    wrapper().dispatchEvent(pointer('pointerenter', 'mouse'));
    await wait(1000);
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    seat().dispatchEvent(event);
    await settle();

    expect(event.defaultPrevented).toBe(false);
    expect(labels()).toEqual([]);
  });
});
