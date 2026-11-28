import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { DiscussionMessage } from '../../models/live-room.model';
import { RoomDiscussion } from './room-discussion';

describe('RoomDiscussion', () => {
  const sampleMessages: DiscussionMessage[] = [
    {
      id: 'm1',
      author: 'Jilali',
      avatarText: 'J',
      avatarClass: 'grad',
      timeLabel: 'Just now',
      text: 'Welcome everyone!',
      isHost: true,
      isYou: true,
      isThreadReply: false,
      reactions: [{ code: 'CLAP', emoji: '👏', label: 'Applause', count: 1, active: false }],
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoomDiscussion],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should render messages and emit sendMessage on non-empty submit', () => {
    const fixture = TestBed.createComponent(RoomDiscussion);
    fixture.componentRef.setInput('messages', sampleMessages);
    fixture.componentRef.setInput('commentCountLabel', '1 comment');
    fixture.componentRef.setInput('chatError', false);
    const sendSpy = vi.fn();
    fixture.componentInstance.sendMessage.subscribe(sendSpy);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Welcome everyone!');

    fixture.componentInstance.draftMessage.set('Hola!');
    fixture.detectChanges();
    fixture.componentInstance.onSendMessage(new Event('submit'));
    expect(sendSpy).toHaveBeenCalledWith('Hola!');
    expect(fixture.componentInstance.draftMessage()).toBe('Hola!');
    fixture.componentInstance.clearSentDraft('Hola!');
    expect(fixture.componentInstance.draftMessage()).toBe('');
  });
  it('preserves the scroll position when a reader is away from the latest messages', () => {
    const fixture = TestBed.createComponent(RoomDiscussion);
    fixture.componentRef.setInput('messages', sampleMessages);
    fixture.componentRef.setInput('commentCountLabel', '1 comment');
    fixture.componentRef.setInput('chatError', false);
    fixture.detectChanges();

    const scroll = fixture.nativeElement.querySelector('#discScroll') as HTMLDivElement;
    Object.defineProperties(scroll, {
      scrollHeight: { value: 1000 },
      clientHeight: { value: 300 },
    });
    scroll.scrollTop = 50;
    scroll.scrollTo = vi.fn();
    fixture.componentRef.setInput('messages', [
      ...sampleMessages,
      { ...sampleMessages[0], id: 'm2' },
    ]);
    fixture.detectChanges();
    fixture.detectChanges();

    expect(scroll.scrollTop).toBe(50);
    expect(scroll.scrollTo).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.new-msgs-wrap').hidden).toBe(false);

    fixture.nativeElement.querySelector('#newMsgsPill').click();
    expect(scroll.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
  });

  it('keeps existing messages mounted while refresh runs and after it fails', () => {
    const fixture = TestBed.createComponent(RoomDiscussion);
    fixture.componentRef.setInput('messages', sampleMessages);
    fixture.componentRef.setInput('commentCountLabel', '1 comment');
    fixture.componentRef.setInput('chatError', false);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const originalMessage = element.querySelector('article');

    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    expect(element.querySelector('article')).toBe(originalMessage);

    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('chatError', true);
    fixture.detectChanges();
    expect(element.querySelector('article')).toBe(originalMessage);
    expect(element.querySelector<HTMLElement>('#discScroll')?.hidden).toBe(false);
    expect(element.querySelector<HTMLElement>('#chatError')?.hidden).toBe(false);
  });

  it('disables reactions when chat-muted and shows character count near the 500-char limit', () => {
    const fixture = TestBed.createComponent(RoomDiscussion);
    fixture.componentRef.setInput('messages', sampleMessages);
    fixture.componentRef.setInput('commentCountLabel', '1 comment');
    fixture.componentRef.setInput('chatError', false);
    fixture.componentRef.setInput('canSend', false);
    fixture.detectChanges();

    const reactionChip = fixture.nativeElement.querySelector(
      '.reaction-chip',
    ) as HTMLButtonElement | null;
    expect(reactionChip?.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[aria-label="Add a reaction"]')).toBeNull();

    fixture.componentRef.setInput('canSend', true);
    fixture.componentInstance.draftMessage.set('a'.repeat(420));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.composer-char-count')?.textContent).toContain(
      '420 / 500',
    );
  });

  it('animates comment reaction chips with Noto Emoji on hover and click/tap', () => {
    const fixture = TestBed.createComponent(RoomDiscussion);
    fixture.componentRef.setInput('messages', sampleMessages);
    fixture.componentRef.setInput('commentCountLabel', '1 comment');
    fixture.componentRef.setInput('chatError', false);
    const toggleSpy = vi.fn();
    fixture.componentInstance.toggleReaction.subscribe(toggleSpy);
    fixture.detectChanges();

    const chip = fixture.nativeElement.querySelector('.reaction-chip') as HTMLButtonElement;
    const emojiEl = chip.querySelector('app-animated-emoji') as HTMLElement;
    expect(emojiEl.getAttribute('data-animated')).toBe('false');

    chip.dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    expect(emojiEl.getAttribute('data-animated')).toBe('true');
    expect(emojiEl.querySelector('source')?.getAttribute('srcset')).toContain('/1f44f/512.webp');

    chip.dispatchEvent(new Event('pointerleave'));
    fixture.detectChanges();
    expect(emojiEl.getAttribute('data-animated')).toBe('false');

    chip.click();
    fixture.detectChanges();
    expect(toggleSpy).toHaveBeenCalledWith({ messageId: 'm1', reaction: 'CLAP' });
    expect(chip.classList.contains('is-bursting')).toBe(true);
    expect(emojiEl.getAttribute('data-animated')).toBe('true');
    expect(fixture.nativeElement.querySelector('.reaction-chip-floater app-animated-emoji')).toBeTruthy();
  });

  it('renders a sticky pinned chat topic banner at the top of chat and lets hosts unpin it', () => {
    const fixture = TestBed.createComponent(RoomDiscussion);
    fixture.componentRef.setInput('messages', sampleMessages);
    fixture.componentRef.setInput('commentCountLabel', '1 comment');
    fixture.componentRef.setInput('chatError', false);
    fixture.componentRef.setInput('isHost', true);
    fixture.componentRef.setInput('pinnedTopic', 'Share one phrase you learned today');
    const topicSpy = vi.fn();
    fixture.componentInstance.topicChange.subscribe(topicSpy);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('#pinnedChatTopic') as HTMLElement | null;
    expect(banner?.textContent).toContain('Share one phrase you learned today');

    const unpinBtn = banner?.querySelector('[aria-label="Unpin chat topic"]') as HTMLButtonElement | null;
    unpinBtn?.click();
    expect(topicSpy).toHaveBeenCalledWith('');
  });

  it('tracks unread count on the Latest messages pill and keeps it hidden while jumping to bottom', () => {
    const fixture = TestBed.createComponent(RoomDiscussion);
    const base = sampleMessages[0]!;
    fixture.componentRef.setInput('messages', sampleMessages);
    fixture.componentRef.setInput('commentCountLabel', '1 comment');
    fixture.componentRef.setInput('chatError', false);
    fixture.detectChanges();

    const scroll = fixture.nativeElement.querySelector('#discScroll') as HTMLDivElement;
    Object.defineProperties(scroll, {
      scrollHeight: { value: 1000, configurable: true },
      clientHeight: { value: 300, configurable: true },
    });
    scroll.scrollTop = 100;
    scroll.scrollTo = vi.fn();

    fixture.componentRef.setInput('messages', [
      ...sampleMessages,
      { ...base, id: 'm2', isYou: false },
      { ...base, id: 'm3', isYou: false },
    ]);
    fixture.detectChanges();
    fixture.detectChanges();

    const pill = fixture.nativeElement.querySelector('#newMsgsPill') as HTMLButtonElement;
    expect(pill.textContent).toContain('2 new messages');
    expect(pill.classList.contains('has-unread')).toBe(true);

    pill.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.showNewMessagesPill()).toBe(false);
    expect(fixture.componentInstance.unreadCount()).toBe(0);

    // Intermediate smooth-scroll progress downward must not flicker the pill back on
    scroll.scrollTop = 260;
    fixture.componentInstance.onScrollMessages();
    expect(fixture.componentInstance.showNewMessagesPill()).toBe(false);
  });

  it('disallows pinning, correcting, and copying GIF messages and hides empty overflow menus', () => {
    const fixture = TestBed.createComponent(RoomDiscussion);
    const base: DiscussionMessage = { ...sampleMessages[0]!, authorId: 'user-1' };
    const gifMessage: DiscussionMessage = {
      ...base,
      id: 'gif-1',
      text: '',
      gifUrl: 'https://media.tenor.com/demo.gif',
    };
    fixture.componentRef.setInput('messages', [base, gifMessage]);
    fixture.componentRef.setInput('commentCountLabel', '2 comments');
    fixture.componentRef.setInput('chatError', false);
    fixture.componentRef.setInput('isHost', true);
    fixture.detectChanges();

    expect(fixture.componentInstance.canPinMessage(base)).toBe(true);
    expect(fixture.componentInstance.canPinMessage(gifMessage)).toBe(false);
    expect(fixture.componentInstance.canCorrectMessage(base)).toBe(true);
    expect(fixture.componentInstance.canCorrectMessage(gifMessage)).toBe(false);
    expect(fixture.componentInstance.canCopyMessage(base)).toBe(true);
    expect(fixture.componentInstance.canCopyMessage(gifMessage)).toBe(false);

    // Open GIF comment overflow menu and confirm View profile, Copy, Pin, and Correct are absent
    const moreButtons = fixture.nativeElement.querySelectorAll('.msg-more-btn') as NodeListOf<HTMLButtonElement>;
    expect(moreButtons.length).toBe(2);
    moreButtons[1]!.click();
    fixture.detectChanges();
    const menuItems = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-panel button[mat-menu-item]'),
    ).map((btn) => btn.textContent?.trim() ?? '');
    expect(menuItems.some((label) => label.includes('View profile'))).toBe(false);
    expect(menuItems.some((label) => label.includes('Copy'))).toBe(false);
    expect(menuItems.some((label) => label.includes('Pin to Stage'))).toBe(false);
    expect(menuItems.some((label) => label.includes('Correct this message'))).toBe(false);
    expect(menuItems.some((label) => label.includes('Reply in thread'))).toBe(true);

    // Non-host with chat disabled has no actions for a GIF message, so the overflow button hides
    fixture.componentRef.setInput('isHost', false);
    fixture.componentRef.setInput('canSend', false);
    fixture.detectChanges();
    expect(fixture.componentInstance.hasCommentActions(base)).toBe(true);
    expect(fixture.componentInstance.hasCommentActions(gifMessage)).toBe(false);
  });

  it('allows moderators to mute/unmute regular users in chat while protecting hosts and other moderators', () => {
    const fixture = TestBed.createComponent(RoomDiscussion);
    const hostMsg: DiscussionMessage = {
      ...sampleMessages[0]!,
      id: 'm-host',
      authorId: 'host-1',
      isHost: true,
      isYou: false,
    };
    const modMsg: DiscussionMessage = {
      ...sampleMessages[0]!,
      id: 'm-mod',
      authorId: 'mod-2',
      isHost: false,
      isYou: false,
    };
    const userMsg: DiscussionMessage = {
      ...sampleMessages[0]!,
      id: 'm-user',
      authorId: 'user-3',
      isHost: false,
      isYou: false,
    };
    fixture.componentRef.setInput('messages', [hostMsg, modMsg, userMsg]);
    fixture.componentRef.setInput('commentCountLabel', '3 comments');
    fixture.componentRef.setInput('chatError', false);
    fixture.componentRef.setInput('isHost', false);
    fixture.componentRef.setInput('canModerate', true);
    fixture.componentRef.setInput('moderatorIds', new Set(['mod-1', 'mod-2']));
    fixture.componentRef.setInput('mutedUsers', new Set(['user-3']));
    fixture.componentRef.setInput('canSend', false);
    fixture.detectChanges();

    expect(fixture.componentInstance.canMuteAuthorInChat(hostMsg)).toBe(false);
    expect(fixture.componentInstance.canMuteAuthorInChat(modMsg)).toBe(false);
    expect(fixture.componentInstance.canMuteAuthorInChat(userMsg)).toBe(true);
    expect(fixture.componentInstance.mutedUsers().has('user-3')).toBe(true);
    expect(fixture.componentInstance.composerPlaceholder()).toBe('You are muted in chat');
  });
});

