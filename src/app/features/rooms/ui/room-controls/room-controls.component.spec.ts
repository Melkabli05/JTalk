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

  it('offers no audio controls, and no status, before there is any audio', async () => {
    await render({});

    expect(labels()).toEqual(['Leave quietly', 'Raise hand']);
    expect(root().querySelector('.audio')?.textContent?.trim()).toBe('');
  });

  it('says how the audio is doing, politely', async () => {
    await render({ audio: 'connecting' });
    expect(root().querySelector('.audio')?.getAttribute('role')).toBe('status');
    expect(root().querySelector('.audio')?.textContent).toContain('Connecting audio…');

    fixture.componentRef.setInput('audio', 'connected');
    await fixture.whenStable();
    expect(root().querySelector('.audio')?.textContent).toContain('Audio connected');

    fixture.componentRef.setInput('audio', 'failed');
    await fixture.whenStable();
    expect(root().querySelector('.audio')?.textContent).toContain('Audio is not available.');
  });

  it('lets someone who may speak mute and unmute', async () => {
    const toggled = vi.fn();
    await render({ canSpeak: true, onStage: true, micOn: true });
    fixture.componentInstance.toggleMic.subscribe(toggled);

    expect(labels()).toEqual(['Leave quietly', 'Mute']);
    click('Mute');
    expect(toggled).toHaveBeenCalledOnce();

    fixture.componentRef.setInput('micOn', false);
    await fixture.whenStable();
    expect(labels()).toEqual(['Leave quietly', 'Unmute']);
  });

  it('asks for a tap to turn the sound on only while the browser blocks it', async () => {
    const enabled = vi.fn();
    await render({ soundBlocked: true });
    fixture.componentInstance.enableSound.subscribe(enabled);

    click('Turn on sound');
    expect(enabled).toHaveBeenCalledOnce();

    fixture.componentRef.setInput('soundBlocked', false);
    await fixture.whenStable();
    expect(labels()).not.toContain('Turn on sound');
  });

  it('offers to reconnect the audio only once it has failed', async () => {
    const retried = vi.fn();
    await render({ audio: 'connected' });
    expect(labels()).not.toContain('Reconnect audio');

    fixture.componentRef.setInput('audio', 'failed');
    await fixture.whenStable();
    fixture.componentInstance.retryAudio.subscribe(retried);
    click('Reconnect audio');

    expect(retried).toHaveBeenCalledOnce();
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
