import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { RoomControlsComponent } from './room-controls.component';

describe('RoomControlsComponent (presentational)', () => {
  let fixture: ComponentFixture<RoomControlsComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const labels = () => [...root().querySelectorAll('button')].map((b) => b.textContent?.trim());
  const click = (label: string) =>
    [...root().querySelectorAll('button')].find((b) => b.textContent?.includes(label))!.click();

  async function render(inputs: Record<string, unknown>) {
    fixture = TestBed.createComponent(RoomControlsComponent);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  it('lets a listener leave or raise a hand', async () => {
    await render({});

    expect(labels()).toEqual(['Leave quietly', 'Raise hand']);
  });

  it('lets a listener with a hand up lower it', async () => {
    await render({ handRaised: true });

    expect(labels()).toEqual(['Leave quietly', 'Lower hand']);
  });

  it('has no hand to raise for someone already on stage', async () => {
    await render({ onStage: true });

    expect(labels()).toEqual(['Leave quietly']);
  });

  it('gives the host the room controls too', async () => {
    await render({ isHost: true, onStage: true });

    expect(labels()).toEqual(['Leave quietly', 'Edit the room', 'End the room']);
  });

  it('disables the hand while a request is running', async () => {
    await render({ busy: true });

    expect(
      [...root().querySelectorAll('button')].find((b) => b.textContent?.includes('Raise hand'))
        ?.disabled,
    ).toBe(true);
  });

  it('emits what was pressed', async () => {
    await render({ isHost: true });
    const emitted: string[] = [];
    const c = fixture.componentInstance;
    c.leave.subscribe(() => emitted.push('leave'));
    c.raiseHand.subscribe(() => emitted.push('raise'));
    c.edit.subscribe(() => emitted.push('edit'));
    c.end.subscribe(() => emitted.push('end'));

    click('Leave quietly');
    click('Raise hand');
    click('Edit the room');
    click('End the room');

    expect(emitted).toEqual(['leave', 'raise', 'edit', 'end']);
  });
});
