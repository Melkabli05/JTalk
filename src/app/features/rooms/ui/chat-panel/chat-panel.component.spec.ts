import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { Person } from '@core/auth/identity.models';
import type { CommentDraft, RoomComment } from '../../models/chat.model';
import { ChatPanelComponent } from './chat-panel.component';

const person = (id: string, name: string): Person => ({
  id,
  name,
  nativeLanguage: 'en',
  learning: 'es',
  avatar: '',
});

const comment = (id: string, authorId: string, content: string, extra = {}): RoomComment => ({
  id,
  authorId,
  type: 'TEXT',
  content,
  createdAt: '2026-11-19T10:00:00Z',
  ...extra,
});

describe('ChatPanelComponent (presentational)', () => {
  let fixture: ComponentFixture<ChatPanelComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const members = new Map([
    ['m-1', person('m-1', 'Mona')],
    ['b-1', person('b-1', 'Bilal')],
  ]);
  const nameOf = (button: Element) =>
    button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '';
  const button = (name: string) =>
    [...root().querySelectorAll('button')].find((b) => nameOf(b) === name);
  const field = (label: string) =>
    [...root().querySelectorAll('app-textarea-field')]
      .find((f) => f.querySelector('label')?.textContent?.trim() === label)
      ?.querySelector('textarea');

  async function render(inputs: Record<string, unknown> = {}) {
    fixture = TestBed.createComponent(ChatPanelComponent);
    const defaults = {
      comments: [],
      members,
      meId: 'm-1',
      ready: true,
      ...inputs,
    };
    for (const [name, value] of Object.entries(defaults)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  async function type(label: string, value: string) {
    const control = field(label)!;
    control.value = value;
    control.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function submit() {
    root()
      .querySelector('form.composer')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
  }

  it('shows each message with who wrote it, as text', async () => {
    await render({ comments: [comment('c-1', 'b-1', '<b>Hola</b> a todos')] });

    const item = root().querySelector('.message-item')!;
    expect(item.querySelector('.author')?.textContent).toContain('Bilal');
    expect(item.querySelector('.text')?.textContent).toBe('<b>Hola</b> a todos');
    expect(item.querySelector('b')).toBeNull();
  });

  it('is a log, so a screen reader hears new messages politely', async () => {
    await render();

    const log = root().querySelector('[role="log"]')!;
    expect(log.getAttribute('aria-live')).toBe('polite');
    expect(root().querySelector('.empty')?.textContent).toContain('No messages yet');
  });

  it('shows a correction as what was said, struck through, and how it should be', async () => {
    await render({
      comments: [
        comment('c-1', 'b-1', 'I goed home', {
          type: 'CORRECTION',
          correctedContent: 'I went home',
        }),
      ],
    });

    expect(root().querySelector('.wrong')?.textContent).toContain('I goed home');
    expect(root().querySelector('.right')?.textContent).toContain('I went home');
  });

  it('quotes the message a reply answers, when it is still there', async () => {
    await render({
      comments: [
        comment('c-1', 'b-1', 'How are you?'),
        comment('c-2', 'm-1', 'Fine', { replyTo: 'c-1' }),
      ],
    });

    expect(root().querySelectorAll('.quote')).toHaveLength(1);
    expect(root().querySelector('.quote')?.textContent).toContain('Bilal: How are you?');
  });

  it('shows placeholders while the chat loads, and a way to try again when it cannot', async () => {
    await render({ ready: false });
    expect(root().querySelector('.loading')).not.toBeNull();

    fixture.componentRef.setInput('failed', true);
    await fixture.whenStable();
    expect(root().textContent).toContain('Could not load the chat.');
    let retried = 0;
    fixture.componentInstance.retry.subscribe(() => retried++);
    button('Try again')!.click();
    expect(retried).toBe(1);
  });

  it('sends what is written, trimmed, and nothing when it is empty', async () => {
    await render();
    const sent: CommentDraft[] = [];
    fixture.componentInstance.submitted.subscribe((draft) => sent.push(draft));

    await submit();
    expect(sent).toEqual([]);

    await type('Message', '  Hola  ');
    await submit();
    expect(sent).toEqual([{ type: 'TEXT', content: 'Hola' }]);
  });

  it('sends a correction with both phrases, and needs the corrected one', async () => {
    await render();
    const sent: CommentDraft[] = [];
    fixture.componentInstance.submitted.subscribe((draft) => sent.push(draft));
    button('Correct')!.click();
    await fixture.whenStable();
    expect(button('Correct')!.getAttribute('aria-pressed')).toBe('true');

    await type('What was said', 'I goed home');
    await submit();
    expect(sent).toEqual([]);

    await type('How it should be', 'I went home');
    await submit();
    expect(sent).toEqual([
      { type: 'CORRECTION', content: 'I goed home', correctedContent: 'I went home' },
    ]);
  });

  it('replies to a message, names who it answers, and lets the reply be dropped', async () => {
    await render({ comments: [comment('c-1', 'b-1', 'How are you?')] });
    const sent: CommentDraft[] = [];
    fixture.componentInstance.submitted.subscribe((draft) => sent.push(draft));

    button('Reply to Bilal')!.click();
    await fixture.whenStable();
    expect(root().querySelector('.replying')?.textContent).toContain('Replying to Bilal');

    await type('Message', 'Fine, thanks');
    await submit();
    expect(sent).toEqual([{ type: 'TEXT', content: 'Fine, thanks', replyTo: 'c-1' }]);

    button('Cancel the reply')!.click();
    await fixture.whenStable();
    expect(root().querySelector('.replying')).toBeNull();
  });

  it('clears what was written once the send has gone through, but keeps it when it failed', async () => {
    await render();
    await type('Message', 'Hola');

    fixture.componentRef.setInput('submitting', true);
    await fixture.whenStable();
    fixture.componentRef.setInput('error', 'Could not send the comment. Please try again.');
    fixture.componentRef.setInput('submitting', false);
    await fixture.whenStable();
    expect(field('Message')!.value).toBe('Hola');
    expect(root().textContent).toContain('Could not send the comment.');

    fixture.componentRef.setInput('error', null);
    fixture.componentRef.setInput('submitting', true);
    await fixture.whenStable();
    fixture.componentRef.setInput('submitting', false);
    await fixture.whenStable();
    expect(field('Message')!.value).toBe('');
  });

  it('says so, and offers no composer, to someone the host muted', async () => {
    await render({ muted: true });

    expect(root().textContent).toContain('The host muted you in the chat');
    expect(root().querySelector('form.composer')).toBeNull();
  });

  it('shows the pinned topic to everyone', async () => {
    await render({ topic: 'Tell us about your weekend' });

    expect(root().querySelector('.topic')?.textContent).toContain('Tell us about your weekend');
    expect(button('Clear the topic')).toBeUndefined();
    expect(root().querySelector('form.pin')).toBeNull();
  });

  describe('for the host', () => {
    const comments = [comment('c-1', 'b-1', 'Hello'), comment('c-2', 'm-1', 'Welcome')];

    it('can delete and mute what others wrote, and not what they wrote themselves', async () => {
      await render({ isHost: true, comments });

      expect(button('Delete the comment by Bilal')).toBeDefined();
      expect(button('Mute Bilal in the chat')).toBeDefined();
      expect(button('Delete the comment by Mona')).toBeUndefined();
    });

    it('asks to delete, mute and unmute', async () => {
      await render({ isHost: true, comments });
      const asked: string[] = [];
      fixture.componentInstance.deleted.subscribe((id) => asked.push(`delete ${id}`));
      fixture.componentInstance.muteRequested.subscribe((id) => asked.push(`mute ${id}`));
      fixture.componentInstance.unmuteRequested.subscribe((id) => asked.push(`unmute ${id}`));

      button('Delete the comment by Bilal')!.click();
      button('Mute Bilal in the chat')!.click();
      fixture.componentRef.setInput('mutedUsers', ['b-1']);
      await fixture.whenStable();
      button('Unmute Bilal in the chat')!.click();

      expect(asked).toEqual(['delete c-1', 'mute b-1', 'unmute b-1']);
      expect(root().textContent).toContain('Muted');
    });

    it('pins a topic, and clears it', async () => {
      await render({ isHost: true, topic: 'Weekend' });
      const asked: string[] = [];
      fixture.componentInstance.pinned.subscribe((text) => asked.push(`pin ${text}`));
      fixture.componentInstance.unpinned.subscribe(() => asked.push('clear'));

      const input = root().querySelector<HTMLInputElement>('form.pin input')!;
      input.value = ' Food ';
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      root()
        .querySelector('form.pin')!
        .dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();
      button('Clear the topic')!.click();

      expect(asked).toEqual(['pin Food', 'clear']);
    });
  });

  it('gives a listener no moderation', async () => {
    await render({ comments: [comment('c-1', 'b-1', 'Hello')] });

    expect(button('Delete the comment by Bilal')).toBeUndefined();
    expect(button('Mute Bilal in the chat')).toBeUndefined();
    expect(button('Reply to Bilal')).toBeDefined();
  });
});
