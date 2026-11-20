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
  /** Opens a message's ⋯ menu and gives its items, which the menu draws on the page. */
  const actionsOf = async (name: string) => {
    button(`Actions for ${name}`)!.click();
    await fixture.whenStable();
    return [
      ...document.body.querySelectorAll<HTMLElement>('.comment-actions .p-menu-item-content'),
    ];
  };
  const labelsOf = (items: HTMLElement[]) =>
    items.map((item) => item.querySelector('.action-label')?.textContent?.trim());
  const pick = async (name: string, label: string) =>
    (await actionsOf(name))
      .find((item) => item.querySelector('.action-label')?.textContent === label)!
      .click();
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
      phone: true,
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

    it('shows every message to scroll through, how many there are, and a way to open them in the drawer', async () => {
      const expanded: unknown[] = [];
      await render({ compact: true, framed: true, expandable: true, comments: many });
      fixture.componentInstance.expand.subscribe((event) => expanded.push(event));

      expect([...root().querySelectorAll('.message-item .text')].map((e) => e.textContent)).toEqual(
        ['Message a', 'Message b', 'Message c', 'Message d', 'Message e'],
      );
      expect(root().querySelector('h2')?.textContent).toBe('Live Discussion');
      expect(root().querySelector('.head .count')?.textContent).toContain('5 messages');

      button('Expand')!.click();
      expect(expanded).toHaveLength(1);
    });

    it('offers no Expand where there is no sheet to open it in', async () => {
      await render({ compact: true, framed: true, comments: many });

      expect(button('Expand')).toBeUndefined();
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

  describe('reactions to a message', () => {
    const tallies = new Map([['c-1', { counts: { CLAP: 4, FIRE: 2 }, mine: 'FIRE' as const }]]);
    const chips = () => [...root().querySelectorAll<HTMLButtonElement>('button[aria-pressed]')];

    it('shows what each message was reacted to with, and which is mine', async () => {
      await render({
        comments: [comment('c-1', 'b-1', 'Hola'), comment('c-2', 'b-1', 'Adiós')],
        reactions: tallies,
      });

      expect(chips().map((chip) => chip.getAttribute('aria-label'))).toEqual([
        'Clap, 4',
        'Fire, 2',
      ]);
      expect(chips().map((chip) => chip.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
      expect(chips().map((chip) => chip.textContent?.trim())).toEqual(['4', '2']);
      expect(
        root().querySelectorAll('.message-item')[1].querySelector('button[aria-pressed]'),
      ).toBeNull();
    });

    it('reacts, or takes it back, by pressing a chip', async () => {
      await render({ comments: [comment('c-1', 'b-1', 'Hola')], reactions: tallies });
      const chosen: unknown[] = [];
      fixture.componentInstance.reacted.subscribe((choice) => chosen.push(choice));

      chips()[0].click();

      expect(chosen).toEqual([{ commentId: 'c-1', reaction: 'CLAP' }]);
    });

    it('offers all ten to choose from on a message, and reacts with the one chosen', async () => {
      await render({ comments: [comment('c-1', 'b-1', 'Hola'), comment('c-2', 'b-1', 'Adiós')] });
      const chosen: unknown[] = [];
      fixture.componentInstance.reacted.subscribe((choice) => chosen.push(choice));

      button('Add a reaction')!.click();
      await fixture.whenStable();
      const choices = [...document.body.querySelectorAll<HTMLButtonElement>('.reaction-choice')];
      expect(choices).toHaveLength(10);
      choices.find((choice) => choice.getAttribute('aria-label') === 'Heart')!.click();

      expect(chosen).toEqual([{ commentId: 'c-1', reaction: 'HEART' }]);
    });

    it('is only to look at for someone the host muted', async () => {
      await render({ comments: [comment('c-1', 'b-1', 'Hola')], reactions: tallies, muted: true });

      expect(button('Add a reaction')).toBeUndefined();
      expect(chips().every((chip) => chip.disabled)).toBe(true);
    });
  });

  it('gives each message a card in the sheet and under the room, and bubbles only beside the room', async () => {
    const comments = [comment('c-1', 'b-1', 'Hola')];
    await render({ comments });
    expect(root().querySelector('section.side')).toBeNull();

    await render({ comments, compact: true, framed: true });
    expect(root().querySelector('section.side')).toBeNull();

    await render({ comments, framed: true });
    expect(root().querySelector('section.side')).not.toBeNull();
  });

  it('marks the host’s messages and the reader’s own with a tag', async () => {
    await render({
      hostId: 'b-1',
      comments: [
        comment('c-1', 'b-1', 'Welcome'),
        comment('c-2', 'm-1', 'Hola'),
        comment('c-3', 'x-1', 'Hi'),
      ],
    });

    const tags = [...root().querySelectorAll('.message-item')].map((item) =>
      item.querySelector('p-tag')?.textContent?.trim(),
    );
    expect(tags).toEqual(['Host', 'You', undefined]);
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
    expect(labelsOf(await actionsOf('Mona'))).not.toContain('Correct');
    await pick('Bilal', 'Correct');
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

    expect(labelsOf(await actionsOf('Bilal'))).not.toContain('Correct');
  });

  describe('writing from the keyboard', () => {
    const send = () => root().querySelector<HTMLButtonElement>('button[type="submit"].send')!;
    const keydown = (key: string, shiftKey = false) => {
      const event = new KeyboardEvent('keydown', {
        key,
        shiftKey,
        bubbles: true,
        cancelable: true,
      });
      field('Message')!.dispatchEvent(event);
      return event;
    };

    it('has the send button off, and says nothing about it, until something is written', async () => {
      await render();

      expect(send().disabled).toBe(true);
      expect(root().querySelector('app-field-errors')?.textContent?.trim() ?? '').toBe('');

      await type('Message', '   ');
      expect(send().disabled).toBe(true);

      await type('Message', 'Hola');
      expect(send().disabled).toBe(false);
    });

    it('sends with Enter, and starts a new line with Shift+Enter', async () => {
      await render();
      const sent: CommentDraft[] = [];
      fixture.componentInstance.submitted.subscribe((draft) => sent.push(draft));
      await type('Message', 'Hola');

      expect(keydown('Enter', true).defaultPrevented).toBe(false);
      expect(sent).toEqual([]);

      expect(keydown('Enter').defaultPrevented).toBe(true);
      await fixture.whenStable();
      expect(sent).toEqual([{ type: 'TEXT', content: 'Hola' }]);
    });

    it('does nothing on Enter while there is nothing to send', async () => {
      await render();
      const sent: CommentDraft[] = [];
      fixture.componentInstance.submitted.subscribe((draft) => sent.push(draft));

      keydown('Enter');
      await fixture.whenStable();

      expect(sent).toEqual([]);
    });

    it('puts the cursor in the message when replying, and drops the reply with Escape', async () => {
      await render({ comments: [comment('c-1', 'b-1', 'How are you?')] });
      document.body.append(root());

      button('Reply to Bilal')!.click();
      await fixture.whenStable();
      expect(root().querySelector('.replying')?.textContent).toContain('Replying to Bilal');
      expect(document.activeElement).toBe(field('Message'));

      expect(keydown('Escape').defaultPrevented).toBe(false);
      await fixture.whenStable();
      expect(root().querySelector('.replying')).toBeNull();
      root().remove();
    });
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

    it('can pin, mute and delete what others wrote, and not what they wrote themselves', async () => {
      await render({ isHost: true, comments });

      expect(labelsOf(await actionsOf('Bilal'))).toEqual([
        'Reply in thread',
        'Correct',
        'Pin to Stage',
        'Copy text',
        'Translate',
        'Mute participant in room',
        'Delete comment',
      ]);
      expect(labelsOf(await actionsOf('Mona'))).toEqual([
        'Reply in thread',
        'Copy text',
        'Translate',
      ]);
    });

    it('asks to delete, mute and unmute', async () => {
      await render({ isHost: true, comments });
      const asked: string[] = [];
      fixture.componentInstance.deleted.subscribe((id) => asked.push(`delete ${id}`));
      fixture.componentInstance.muteRequested.subscribe((id) => asked.push(`mute ${id}`));
      fixture.componentInstance.unmuteRequested.subscribe((id) => asked.push(`unmute ${id}`));

      await pick('Bilal', 'Delete comment');
      await pick('Bilal', 'Mute participant in room');
      fixture.componentRef.setInput('mutedUsers', ['b-1']);
      await fixture.whenStable();
      await pick('Bilal', 'Unmute participant in room');

      expect(asked).toEqual(['delete c-1', 'mute b-1', 'unmute b-1']);
      expect(root().textContent).toContain('Muted');
    });

    it('lets the host clear the pinned topic', async () => {
      await render({ isHost: true, topic: 'Weekend' });
      const asked: string[] = [];
      fixture.componentInstance.topicUnpinned.subscribe(() => asked.push('clear'));

      button('Clear the topic')!.click();

      expect(asked).toEqual(['clear']);
    });
  });

  it('says how many answered a message, and takes the reader to the first answer', async () => {
    await render({
      comments: [
        comment('c-1', 'b-1', 'Question?'),
        comment('c-2', 'm-1', 'Answer', { replyTo: 'c-1' }),
        comment('c-3', 'm-1', 'Another', { replyTo: 'c-1' }),
        comment('c-4', 'm-1', 'One answer', { replyTo: 'c-3' }),
      ],
    });
    const items = [...root().querySelectorAll<HTMLElement>('.message-item')];
    const scroll = vi.fn();
    items[1].scrollIntoView = scroll;
    expect(items[0].textContent).toContain('2 replies');
    expect(items[2].textContent).toContain('1 reply');
    expect(items[1].textContent).not.toMatch(/\d replies?/);

    [...items[0].querySelectorAll('button')]
      .find((b) => b.textContent?.includes('2 replies'))!
      .click();

    expect(scroll).toHaveBeenCalled();
  });

  it('opens a sheet for a message, titled with the start of it, which Cancel closes', async () => {
    await render({ comments: [comment('c-1', 'b-1', 'x'.repeat(80))] });
    const copied: string[] = [];
    const translating: string[] = [];
    fixture.componentInstance.textCopied.subscribe((text) => copied.push(text));
    fixture.componentInstance.translateRequested.subscribe((text) => translating.push(text));

    await actionsOf('Bilal');
    expect(document.body.querySelector('.sheet-heading h2')?.textContent).toBe('Comment actions');
    expect(document.body.querySelector('.excerpt')?.textContent).toBe(`“${'x'.repeat(48)}…”`);

    await pick('Bilal', 'Copy text');
    expect(copied).toEqual(['x'.repeat(80)]);
    await pick('Bilal', 'Translate');
    expect(translating).toEqual(['x'.repeat(80)]);

    await actionsOf('Bilal');
    document.body
      .querySelector<HTMLButtonElement>('.comment-actions .sheet-footer button')!
      .click();
    await fixture.whenStable();
    expect(document.body.querySelector('.comment-actions')).toBeNull();
  });

  describe('on a larger screen', () => {
    const popoverItems = () => [
      ...document.body.querySelectorAll<HTMLElement>(
        '.comment-actions-popover .p-menu-item-content',
      ),
    ];

    it('opens the actions as a card at the message: its title, the start of the message, plain icons and quiet hints', async () => {
      await render({
        phone: false,
        isHost: true,
        language: 'en',
        comments: [comment('c-1', 'b-1', 'Hello there')],
      });

      button('Actions for Bilal')!.click();
      await fixture.whenStable();

      const card = document.body.querySelector('.comment-actions-popover');
      expect(card?.querySelector('.pop-head h2')?.textContent).toBe('Comment actions');
      expect(card?.querySelector('.pop-excerpt')?.textContent).toBe('“Hello there”');
      expect(
        popoverItems().map((item) => item.querySelector('.action-label')?.textContent),
      ).toEqual([
        'Reply in thread',
        'Correct',
        'Pin to Stage',
        'Copy text',
        'Translate to EN',
        'Mute Bilal in the chat',
        'Delete comment',
      ]);
      expect(popoverItems()[0].querySelector('.hint')?.textContent).toBe('⌘R');
      expect(popoverItems().at(-1)?.querySelector('.hint')?.textContent).toBe('Moderator');
      expect(document.body.querySelector('p-drawer.comment-actions')).toBeNull();
    });

    it('shows the key of the shortcut as the reader’s keyboard has it', async () => {
      await render({
        phone: false,
        modifier: 'Ctrl',
        comments: [comment('c-1', 'b-1', 'Hello')],
      });

      button('Actions for Bilal')!.click();
      await fixture.whenStable();

      expect(popoverItems()[0].querySelector('.hint')?.textContent).toBe('Ctrl+R');
    });

    it('puts the reader back on the message’s menu button once an action is chosen', async () => {
      await render({ phone: false, comments: [comment('c-1', 'b-1', 'Hello')] });
      document.body.append(root());
      const opener = button('Actions for Bilal')!;
      opener.focus();

      opener.click();
      await fixture.whenStable();
      popoverItems()
        .find((item) => item.querySelector('.action-label')?.textContent === 'Copy text')!
        .click();
      await fixture.whenStable();
      await Promise.resolve();

      expect(document.activeElement).toBe(opener);
      root().remove();
    });

    it('answers the message with Command-R while the actions are open', async () => {
      await render({ phone: false, comments: [comment('c-1', 'b-1', 'Hello')] });
      button('Actions for Bilal')!.click();
      await fixture.whenStable();

      const event = new KeyboardEvent('keydown', {
        key: 'r',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.body.querySelector('.pop')!.dispatchEvent(event);
      await fixture.whenStable();

      expect(event.defaultPrevented).toBe(true);
      expect(root().querySelector('.replying')?.textContent).toContain('Replying to Bilal');
    });
  });

  it('gives a listener no moderation', async () => {
    await render({ comments: [comment('c-1', 'b-1', 'Hello')] });

    expect(labelsOf(await actionsOf('Bilal'))).toEqual([
      'Reply in thread',
      'Correct',
      'Copy text',
      'Translate',
    ]);
    expect(button('Reply to Bilal')).toBeDefined();
  });
});
