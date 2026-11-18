import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { RoomControlsComponent } from './room-controls.component';

describe('RoomControlsComponent (presentational)', () => {
  let fixture: ComponentFixture<RoomControlsComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const nameOf = (button: Element) =>
    button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '';
  const names = () => [...root().querySelectorAll('button')].map(nameOf);
  const button = (name: string) =>
    [...root().querySelectorAll('button')].find((b) => nameOf(b) === name)!;
  const click = (name: string) => button(name).click();

  async function render(inputs: Record<string, unknown>) {
    fixture = TestBed.createComponent(RoomControlsComponent);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  it('lets a listener leave or raise a hand', async () => {
    await render({});

    expect(names()).toEqual(['Leave quietly', 'Raise hand']);
  });

  it('says nothing while all is well, and before there is any audio', async () => {
    await render({});
    expect(root().querySelector('.notes')?.textContent?.trim()).toBe('');

    fixture.componentRef.setInput('audio', 'connected');
    await fixture.whenStable();
    expect(root().querySelector('.notes')?.textContent?.trim()).toBe('');
  });

  it('says it politely while connecting, and as a warning while the link is being re-made', async () => {
    await render({ audio: 'connecting' });
    expect(root().querySelector('.connecting')?.getAttribute('role')).toBe('status');
    expect(root().querySelector('.connecting')?.textContent).toContain('Connecting audio…');

    fixture.componentRef.setInput('audio', 'reconnecting');
    await fixture.whenStable();
    expect(root().querySelector('.connecting')).toBeNull();
    expect(root().querySelector('p-message[role="alert"]')?.textContent).toContain('Reconnecting…');
  });

  it('raises an alert when the audio is lost or the microphone refused', async () => {
    await render({ audio: 'failed', micRefused: true });

    const alerts = [...root().querySelectorAll('[role="alert"]')].map((el) => el.textContent);
    expect(alerts[0]).toContain('Audio is not available.');
    expect(alerts[1]).toContain('We could not use your microphone.');
  });

  it('lets someone who may speak mute and unmute, with a button that names what it does', async () => {
    const toggled = vi.fn();
    await render({ canSpeak: true, onStage: true, micOn: true });
    fixture.componentInstance.toggleMic.subscribe(toggled);

    expect(names()).toEqual(['Leave quietly', 'Mute']);
    click('Mute');
    expect(toggled).toHaveBeenCalledOnce();

    fixture.componentRef.setInput('micOn', false);
    await fixture.whenStable();
    expect(names()).toEqual(['Leave quietly', 'Unmute']);
  });

  it('asks for a tap to turn the sound on only while the browser blocks it', async () => {
    const enabled = vi.fn();
    await render({ soundBlocked: true });
    fixture.componentInstance.enableSound.subscribe(enabled);

    click('Turn on sound');
    expect(enabled).toHaveBeenCalledOnce();

    fixture.componentRef.setInput('soundBlocked', false);
    await fixture.whenStable();
    expect(names()).not.toContain('Turn on sound');
  });

  it('offers to reconnect the audio only once it has failed', async () => {
    const retried = vi.fn();
    await render({ audio: 'connected' });
    expect(names()).not.toContain('Reconnect audio');

    fixture.componentRef.setInput('audio', 'failed');
    await fixture.whenStable();
    fixture.componentInstance.retryAudio.subscribe(retried);
    click('Reconnect audio');

    expect(retried).toHaveBeenCalledOnce();
  });

  it('makes the hand a toggle: pressed while the request waits, and pressing again takes it back', async () => {
    const raised = vi.fn();
    const lowered = vi.fn();
    await render({});
    fixture.componentInstance.raiseHand.subscribe(raised);
    fixture.componentInstance.lowerHand.subscribe(lowered);
    expect(button('Raise hand').getAttribute('aria-pressed')).toBe('false');
    click('Raise hand');
    expect(raised).toHaveBeenCalledOnce();

    fixture.componentRef.setInput('handRaised', true);
    await fixture.whenStable();
    expect(button('Raise hand').getAttribute('aria-pressed')).toBe('true');
    expect(root().textContent).toContain('Waiting for the host to let you speak.');
    click('Raise hand');
    expect(lowered).toHaveBeenCalledOnce();
  });

  it('has no hand to raise for someone already on stage', async () => {
    await render({ onStage: true });

    expect(names()).toEqual(['Leave quietly']);
  });

  it('gives only the host a menu of the room actions', async () => {
    await render({ onStage: true });
    expect(names()).not.toContain('More actions');

    fixture.componentRef.setInput('actions', [{ label: 'Edit the room' }]);
    await fixture.whenStable();
    expect(names()).toEqual(['Leave quietly', 'More actions']);
  });

  it('disables the hand while a request is running', async () => {
    await render({ busy: true });

    expect(button('Raise hand').disabled).toBe(true);
  });

  it('emits what was pressed, and runs the host actions the page gave it from their menu', async () => {
    const edited = vi.fn();
    await render({
      actions: [{ label: 'Edit the room', command: edited }],
    });
    const emitted: string[] = [];
    const c = fixture.componentInstance;
    c.leave.subscribe(() => emitted.push('leave'));
    c.raiseHand.subscribe(() => emitted.push('raise'));

    click('Leave quietly');
    click('Raise hand');
    click('More actions');
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    [...document.querySelectorAll<HTMLElement>('.p-menu-item-link')]
      .find((item) => item.textContent?.includes('Edit the room'))!
      .click();

    expect(emitted).toEqual(['leave', 'raise']);
    expect(edited).toHaveBeenCalledOnce();
  });

  it('labels the mic and the hand in words, and draws the hand as an icon', async () => {
    await render({ canSpeak: true, micOn: true });

    expect(button('Mute').textContent).toContain('Mute');
    expect(button('Raise hand').textContent).toContain('Raise hand');
    expect(button('Raise hand').querySelector('.pi-hand')).not.toBeNull();
  });

  it('keeps the leave button named when its label is hidden on a narrow dock', async () => {
    await render({});

    const leave = button('Leave quietly');
    expect(leave.getAttribute('aria-label')).toBe('Leave quietly');
    expect(leave.classList).toContain('leave-compact');
  });

  it('shows the waiting hint with the hand icon, politely', async () => {
    await render({ handRaised: true });

    const hint = root().querySelector('.hint');
    expect(hint?.getAttribute('role')).toBe('status');
    expect(hint?.querySelector('.pi-hand')?.getAttribute('aria-hidden')).toBe('true');
  });
});
