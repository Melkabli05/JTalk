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

    expect(names()).toEqual(['Raise hand', 'Chat', 'React', 'Leave quietly']);
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
    expect(alerts[1]).toContain('Your microphone is blocked.');
  });

  it('lets someone who may speak mute and unmute, with a button that names what it does', async () => {
    const toggled = vi.fn();
    await render({ canSpeak: true, audio: 'connected', onStage: true, micOn: true });
    fixture.componentInstance.toggleMic.subscribe(toggled);

    expect(names()).toEqual(['Mute', 'Chat', 'React', 'Leave quietly']);
    click('Mute');
    expect(toggled).toHaveBeenCalledOnce();

    fixture.componentRef.setInput('micOn', false);
    await fixture.whenStable();
    expect(names()).toEqual(['Unmute', 'Chat', 'React', 'Leave quietly']);
  });

  it('gives the host the room’s own tools, and nobody else', async () => {
    const asked: string[] = [];
    await render({ canSpeak: true, audio: 'connected', onStage: true, micOn: true, isHost: true });
    fixture.componentInstance.editRoom.subscribe(() => asked.push('edit'));
    fixture.componentInstance.endRoom.subscribe(() => asked.push('end'));

    expect(names()).toEqual([
      'Mute',
      'Chat',
      'React',
      'Edit the room',
      'End the room',
      'Leave quietly',
    ]);
    click('Edit the room');
    click('End the room');
    expect(asked).toEqual(['edit', 'end']);

    fixture.componentRef.setInput('isHost', false);
    await fixture.whenStable();
    expect(names()).toEqual(['Mute', 'Chat', 'React', 'Leave quietly']);
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

    expect(names()).toEqual(['Chat', 'React', 'Leave quietly']);
  });

  it('disables the hand while a request is running', async () => {
    await render({ busy: true });

    expect(button('Raise hand').disabled).toBe(true);
  });

  it('emits what was pressed', async () => {
    await render({});
    const emitted: string[] = [];
    const c = fixture.componentInstance;
    c.leave.subscribe(() => emitted.push('leave'));
    c.raiseHand.subscribe(() => emitted.push('raise'));

    click('Leave quietly');
    click('Raise hand');

    expect(emitted).toEqual(['leave', 'raise']);
  });

  it('draws the small controls as circles, the main one as a labelled pill, and leaving apart', async () => {
    await render({ canSpeak: true, audio: 'connected', micOn: true });

    for (const name of ['Mute', 'Chat', 'React']) {
      const circle = button(name);
      expect(circle.className).toContain('p-button-rounded');
      expect(circle.className).toContain('p-button-icon-only');
      expect(circle.textContent?.trim()).toBe('');
    }
    const hand = button('Raise hand');
    expect(hand.textContent).toContain('Raise hand');
    expect(hand.className).toContain('p-button-primary');
    expect(hand.className).not.toContain('p-button-outlined');
    expect(hand.querySelector('.pi-hand')).not.toBeNull();

    const leave = button('Leave quietly');
    expect(leave.textContent).toContain('Leave quietly');
    expect(leave.className).toContain('p-button-danger');
    expect(leave.classList).toContain('leave-compact');
    expect(root().querySelector('.divider')?.getAttribute('aria-hidden')).toBe('true');
    expect(root().querySelector('.caption')).toBeNull();
  });

  it('shows the microphone in Forest while it is on and neutral while it is off', async () => {
    await render({ canSpeak: true, audio: 'connected', micOn: true });
    expect(button('Mute').className).toContain('p-button-primary');

    await render({ canSpeak: true, audio: 'connected', micOn: false });
    expect(button('Unmute').className).toContain('p-button-secondary');
    expect(button('Unmute').className).toContain('p-button-outlined');
  });

  it('shows the raised hand as pressed, and lowers it with the same press', async () => {
    const lowered = vi.fn();
    await render({ handRaised: true });
    fixture.componentInstance.lowerHand.subscribe(lowered);

    expect(button('Raise hand').getAttribute('aria-pressed')).toBe('true');
    expect(button('Raise hand').className).toContain('p-button-outlined');
    click('Raise hand');

    expect(lowered).toHaveBeenCalledOnce();
  });

  it('shows the waiting hint with the hand icon, politely', async () => {
    await render({ handRaised: true });

    const hint = root().querySelector('.hint');
    expect(hint?.getAttribute('role')).toBe('status');
    expect(hint?.querySelector('.pi-hand')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('lets anyone open a picker of reactions and sends the one they choose', async () => {
    const reacted = vi.fn();
    await render({});
    fixture.componentInstance.react.subscribe(reacted);

    expect(names()).toContain('React');
    click('React');
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));

    const choices = [...document.querySelectorAll<HTMLButtonElement>('.p-popover button')];
    expect(choices.map(nameOf)).toEqual([
      'Heart',
      'Clap',
      'Thumbs up',
      'Smile',
      'Sparkles',
      'Fire',
      'Party',
      'Laugh',
      'Wow',
      'Thanks',
    ]);
    choices.find((choice) => nameOf(choice) === 'Smile')!.click();

    expect(reacted).toHaveBeenCalledExactlyOnceWith('SMILE');
  });

  it('puts the way out of a problem inside the message that reports it, not in the dock', async () => {
    await render({ audio: 'failed', soundBlocked: true });

    const messages = [...root().querySelectorAll('p-message')];
    expect(messages.map((m) => m.textContent)).toEqual([
      expect.stringContaining('Audio is not available.'),
      expect.stringContaining('Sound is off in this browser.'),
    ]);
    expect(messages[0]?.querySelector('button')?.textContent).toContain('Reconnect audio');
    expect(messages[1]?.querySelector('button')?.textContent).toContain('Turn on sound');
    expect(root().querySelector('p-toolbar')?.textContent).not.toContain('Turn on sound');
    expect(root().querySelector('p-toolbar')?.textContent).not.toContain('Reconnect audio');
  });

  it('keeps all the controls in one centered row, leaving last', async () => {
    await render({ onStage: true, canSpeak: true, audio: 'connected' });

    expect([...root().querySelectorAll('.p-toolbar-center button')].map(nameOf)).toEqual([
      'Unmute',
      'Chat',
      'React',
      'Leave quietly',
    ]);
    expect(root().querySelector('.p-toolbar-start button')).toBeNull();
    expect(root().querySelector('.p-toolbar-end button')).toBeNull();
  });

  describe('only what the person can do', () => {
    const shown = () => [...root().querySelectorAll('.p-toolbar-center button')].map(nameOf);

    it('gives the audience a hand to raise, a reaction and a way out: no microphone, no stepping down', async () => {
      await render({ audio: 'connected' });

      expect(shown()).toEqual(['Raise hand', 'Chat', 'React', 'Leave quietly']);
    });

    it('gives someone on the stage the microphone and a way down, and no hand to raise', async () => {
      await render({ onStage: true, canSpeak: true, canStepDown: true, audio: 'connected' });

      expect(shown()).toEqual([
        'Unmute',
        'Step down to the audience',
        'Chat',
        'React',
        'Leave quietly',
      ]);
    });

    it('gives the host the microphone but no way down: the host keeps the stage', async () => {
      await render({ onStage: true, canSpeak: true, canStepDown: false, audio: 'connected' });

      expect(shown()).toEqual(['Unmute', 'Chat', 'React', 'Leave quietly']);
    });

    it('steps down when asked to', async () => {
      const stepped = vi.fn();
      await render({ onStage: true, canSpeak: true, canStepDown: true, audio: 'connected' });
      fixture.componentInstance.stepDown.subscribe(stepped);

      click('Step down to the audience');

      expect(stepped).toHaveBeenCalledOnce();
    });

    it.each(['idle', 'connecting', 'reconnecting', 'failed'] as const)(
      'offers no microphone while the audio is %s, since there is nothing to speak into',
      async (audio) => {
        await render({ onStage: true, canSpeak: true, audio });

        expect(names()).not.toContain('Mute');
        expect(names()).not.toContain('Unmute');
        expect(names()).toContain('React');
        expect(names()).toContain('Leave quietly');
      },
    );

    it('keeps the microphone when the browser refused it, so it can be tried again', async () => {
      await render({ onStage: true, canSpeak: true, audio: 'connected', micRefused: true });

      expect(names()).toContain('Unmute');
    });
  });

  describe('the chat button', () => {
    it('opens the chat', async () => {
      await render({});
      let opened = 0;
      fixture.componentInstance.chat.subscribe(() => opened++);

      click('Chat');

      expect(opened).toBe(1);
    });

    it('says how many messages are waiting, in words and in a badge', async () => {
      await render({ unread: 3 });

      expect(names()).toContain('Chat, 3 unread');
      expect(root().querySelector('.p-overlaybadge .p-badge')?.textContent?.trim()).toBe('3');
    });

    it('shows no badge when nothing is waiting', async () => {
      await render({ unread: 0 });

      expect(root().querySelector('p-badge')?.textContent?.trim() ?? '').toBe('');
      expect(names()).toContain('Chat');
    });
  });
});
