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

  it('says how long ago each message was written', async () => {
    const written = new Date(Date.now() - 5 * 60_000).toISOString();
    await render({ comments: [comment('c-1', 'b-1', 'Hola', { createdAt: written })] });

    expect(root().querySelector('time')?.textContent?.trim()).toBe('5m ago');
    expect(root().querySelector('time')?.getAttribute('datetime')).toBe(written);
  });

  describe('beside the stage', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((id) => comment(id, 'b-1', `Message ${id}`));

    it('shows the last three messages, how many there are, and a way to open them all', async () => {
      const expanded: unknown[] = [];
      await render({ compact: true, framed: true, comments: many });
      fixture.componentInstance.expand.subscribe((event) => expanded.push(event));

      expect([...root().querySelectorAll('.message-item .text')].map((e) => e.textContent)).toEqual(
        ['Message c', 'Message d', 'Message e'],
      );
      expect(root().querySelector('h2')?.textContent).toBe('Live Discussion');
      expect(root().querySelector('.head .count')?.textContent).toContain('5 messages');

      button('Expand')!.click();
      expect(expanded).toHaveLength(1);
    });

    it('can still be written in and replied to, but leaves pinning a topic to the full view', async () => {
      await render({ compact: true, comments: many, isHost: true });

      expect(root().querySelector('form.composer')).not.toBeNull();
      expect(button('Reply to Bilal')).toBeDefined();
      expect(root().querySelector('form.pin')).toBeNull();
    });

    it('is the whole thread, with no header, in the drawer', async () => {
      await render({ comments: many });

      expect(root().querySelectorAll('.message-item')).toHaveLength(5);
      expect(root().querySelector('.head')).toBeNull();
    });

    it('is the whole thread under a header, but with nothing to expand, in a column of its own', async () => {
      await render({ framed: true, comments: many });

      expect(root().querySelectorAll('.message-item')).toHaveLength(5);
      expect(root().querySelector('h2')?.textContent).toBe('Live Discussion');
      expect(button('Expand')).toBeUndefined();
    });
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

  it('corrects what someone else wrote: their words and the right ones, answering their message', async () => {
    await render({
      comments: [comment('c-1', 'b-1', 'I goed home'), comment('c-2', 'm-1', 'I am Mona')],
    });
    const sent: CommentDraft[] = [];
    fixture.componentInstance.submitted.subscribe((draft) => sent.push(draft));
    expect(button('Correct Mona')).toBeUndefined();

    button('Correct Bilal')!.click();
    await fixture.whenStable();
    expect(root().querySelector('.replying')?.textContent).toContain('Correcting Bilal');

    await type('Message', 'I went home');
    await submit();
    expect(sent).toEqual([
      {
        type: 'CORRECTION',
        content: 'I goed home',
        correctedContent: 'I went home',
        replyTo: 'c-1',
      },
    ]);
  });

  it('offers no correction of a correction', async () => {
    await render({
      comments: [
        comment('c-1', 'b-1', 'I goed home', {
          type: 'CORRECTION',
          correctedContent: 'I went home',
        }),
      ],
    });

    expect(button('Correct Bilal')).toBeUndefined();
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

    button('Cancel')!.click();
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
