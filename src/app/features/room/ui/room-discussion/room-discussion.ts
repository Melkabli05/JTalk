import { BackendReaction, REACTION_CATALOG } from '../../../../shared/models/voice-room.model';
import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { form, FormField, maxLength, readonly } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SkeletonLoader } from '../../../../shared/ui/skeleton-loader/skeleton-loader';
import { DiscussionMessage } from '../../models/live-room.model';

@Component({
  selector: 'app-room-discussion',
  imports: [
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatRippleModule,
    MatTooltipModule,
    SkeletonLoader,
  ],
  templateUrl: './room-discussion.html',
  styleUrl: './room-discussion.scss',
})
export class RoomDiscussion {
  private readonly discScrollRef = viewChild<ElementRef<HTMLDivElement>>('discScroll');
  private readonly composerInputRef = viewChild<ElementRef<HTMLTextAreaElement>>('composerInput');

  readonly messages = input.required<readonly DiscussionMessage[]>();
  readonly commentCountLabel = input.required<string>();
  readonly loading = input(false);
  readonly chatError = input.required<boolean>();
  readonly replyTarget = input<string | null>(null);
  readonly showNewMessagesPill = signal(false);
  readonly correcting = input(false);
  readonly pinnedTopic = input<string | null>(null);
  readonly pinnedMessageId = input<string | null>(null);
  readonly topicChange = output<string>();
  readonly editingTopic = signal(false);
  readonly isHost = input(false);
  readonly canSend = input(true);

  readonly mutedUsers = input<ReadonlySet<string>>(new Set());
  readonly retryChat = output<void>();
  readonly refreshChat = output<void>();
  readonly replyCleared = output<void>();
  readonly sendMessage = output<string>();
  readonly emptySendAttempt = output<void>();
  readonly toggleReaction = output<{
    messageId: string;
    reaction: BackendReaction;
  }>();
  readonly commentAction = output<{
    action: 'reply' | 'pin' | 'copy' | 'correct' | 'mute' | 'delete';
    message: DiscussionMessage;
  }>();

  readonly skeletonMessages = [
    { id: 1, authorWidth: '68px', lines: 2, hasReaction: false, isReply: false },
    { id: 2, authorWidth: '82px', lines: 2, hasReaction: true, isReply: false },
    { id: 3, authorWidth: '60px', lines: 1, hasReaction: false, isReply: true },
    { id: 4, authorWidth: '76px', lines: 2, hasReaction: true, isReply: false },
  ] as const;

  readonly reactionEmojis = REACTION_CATALOG;
  readonly sending = input(false);
  readonly draftMessage = signal('');
  readonly messageField = form(this.draftMessage, (path) => {
    maxLength(path, 500);
    readonly(path, () => !this.canSend());
  });

  private hasInitialScrolled = false;
  private lastMessageCount = 0;
  private lastBottomMessageId: string | null = null;
  private forceScrollBottom = false;

  readonly composerPlaceholder = computed(() => {
    if (!this.canSend()) return 'Chat is currently disabled';
    if (this.correcting()) return 'Write the corrected text…';
    const target = this.replyTarget();
    return target ? `Reply to ${target}…` : 'Say something to the room…';
  });

  readonly composerAriaLabel = computed(() => {
    if (this.correcting()) return 'Write the corrected text…';
    const target = this.replyTarget();
    return target ? `Reply to ${target}` : 'Say something to the room';
  });

  readonly showCharCount = computed(() => this.draftMessage().length > 400);

  constructor() {
    afterRenderEffect({
      earlyRead: () => {
        const list = this.messages();
        if (list.length === 0 && (this.loading() || this.chatError())) return null;
        const scrollEl = this.discScrollRef()?.nativeElement;
        if (!scrollEl) return null;
        const bottom = scrollEl.scrollHeight;
        return {
          scrollEl,
          bottom,
          nearBottom: bottom - scrollEl.scrollTop - scrollEl.clientHeight <= 96,
          messageCount: list.length,
          lastMessageId: list.at(-1)?.id ?? null,
        };
      },
      write: (readResult) => {
        const snapshot = readResult();
        if (!snapshot) return;

        const { scrollEl, bottom, nearBottom, messageCount, lastMessageId } = snapshot;
        const appended =
          messageCount > this.lastMessageCount ||
          (lastMessageId !== null && lastMessageId !== this.lastBottomMessageId);
        this.lastMessageCount = messageCount;
        this.lastBottomMessageId = lastMessageId;

        if (!this.hasInitialScrolled) {
          this.hasInitialScrolled = true;
          scrollEl.scrollTop = bottom;
        } else if (this.forceScrollBottom || (appended && nearBottom)) {
          this.scrollToBottomSmooth(scrollEl, bottom);
        } else if (appended) {
          this.showNewMessagesPill.set(true);
        }
        this.forceScrollBottom = false;
      },
    });
  }

  commentActionsAriaLabel(author: string): string {
    return `Comment actions for ${author}'s message`;
  }

  isEmojiActive(msg: DiscussionMessage, emoji: string): boolean {
    return msg.reactions.some((r) => r.emoji === emoji && r.active);
  }

  onReplyTo(message: DiscussionMessage): void {
    this.commentAction.emit({ action: 'reply', message });
    this.composerInputRef()?.nativeElement.focus();
  }

  onCorrectMessage(message: DiscussionMessage): void {
    this.commentAction.emit({ action: 'correct', message });
    this.composerInputRef()?.nativeElement.focus();
  }

  onSaveTopic(event: Event, rawValue: string): void {
    event.preventDefault();
    const trimmed = rawValue.trim();
    if (!trimmed && !this.pinnedTopic()) {
      this.editingTopic.set(false);
      return;
    }
    this.topicChange.emit(trimmed);
    this.editingTopic.set(false);
  }

  clearReplyTarget(): void {
    this.replyCleared.emit();
  }

  onSendMessage(event: Event): void {
    event.preventDefault();
    if (!this.canSend() || this.sending() || this.messageField().invalid()) return;
    const text = this.draftMessage().trim();
    if (!text) {
      this.emptySendAttempt.emit();
      this.composerInputRef()?.nativeElement.focus();
      return;
    }
    this.forceScrollBottom = true;
    this.sendMessage.emit(text);
    const scrollEl = this.discScrollRef()?.nativeElement;
    if (scrollEl) {
      this.scrollToBottomSmooth(scrollEl);
    }
    this.showNewMessagesPill.set(false);
  }

  clearSentDraft(sent: string): void {
    if (this.draftMessage().trim() === sent) this.draftMessage.set('');
  }

  onComposerKey(event: KeyboardEvent): void {
    if (event.isComposing) return;
    if (event.key === 'Enter' && !event.shiftKey) this.onSendMessage(event);
    if (event.key === 'Escape') this.clearReplyTarget();
  }

  onScrollMessages(): void {
    const scrollEl = this.discScrollRef()?.nativeElement;
    if (!scrollEl) return;
    const distanceFromBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    this.showNewMessagesPill.set(distanceFromBottom > 80);
  }

  onJumpToNewest(): void {
    const scrollEl = this.discScrollRef()?.nativeElement;
    if (scrollEl) {
      this.scrollToBottomSmooth(scrollEl);
    }
    this.showNewMessagesPill.set(false);
  }

  private scrollToBottomSmooth(el: HTMLDivElement, bottom = el.scrollHeight): void {
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top: bottom, behavior: 'smooth' });
    } else {
      el.scrollTop = bottom;
    }
  }
}
