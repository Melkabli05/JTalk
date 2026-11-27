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
});
