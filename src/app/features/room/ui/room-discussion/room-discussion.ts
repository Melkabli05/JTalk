import {
  BackendReaction,
  GifItem,
  REACTION_CATALOG,
  type ReactionPresentation,
} from '../../../../shared/models/voice-room.model';
import {
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
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
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AnimatedEmoji } from '../../../../shared/ui/animated-emoji/animated-emoji';
import { SkeletonLoader } from '../../../../shared/ui/skeleton-loader/skeleton-loader';
import { sanitizeUserText } from '../../../../shared/utils/form-validators';
import {
  preloadNotoReactionAnimations,
  REACTION_BURST_DURATION_MS,
  ROOM_REACTION_LAUNCH_MS,
} from '../../../../shared/utils/noto-emoji.utils';
import { DiscussionMessage } from '../../models/live-room.model';
import {
  canCopyMessage,
  canCorrectMessage,
  canPinMessageToStage,
  canScrollChat,
  formatLatestMessagesLabel,
  isNearChatBottom,
  resolveScrollPillState,
} from '../../utils/chat-scroll.utils';

interface CommentReactionBurst {
  readonly id: number;
  readonly messageId: string;
  readonly code: BackendReaction;
  readonly emoji: string;
}

const BLOCKED_IMAGE_PATTERN =
  /(?:data:image\/|<img\b|!\[[^\]]*\]\([^)]+\)|https?:\/\/\S+\.(?:png|jpe?g|webp|gif|svg|bmp|avif)(?:[?#]\S*)?)/i;

@Component({
  selector: 'app-room-discussion',
  imports: [
    AnimatedEmoji,
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly chipBurstTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private messageBurstTimer: ReturnType<typeof setTimeout> | null = null;
  private messageBurstSeq = 0;
  private readonly discScrollRef = viewChild<ElementRef<HTMLDivElement>>('discScroll');
  private readonly composerInputRef = viewChild<ElementRef<HTMLTextAreaElement>>('composerInput');
  private readonly gifMenuTrigger = viewChild<MatMenuTrigger>('gifMenuTrigger');
  private readonly gifSearchInputRef = viewChild<ElementRef<HTMLInputElement>>('gifSearchInput');

  readonly messages = input.required<readonly DiscussionMessage[]>();
  readonly commentCountLabel = input.required<string>();
  readonly loading = input(false);
  readonly chatError = input.required<boolean>();
  readonly replyTarget = input<string | null>(null);
  readonly showNewMessagesPill = signal(false);
  readonly unreadCount = signal(0);
  readonly latestMessagesLabel = computed(() => formatLatestMessagesLabel(this.unreadCount()));
  readonly correcting = input(false);
  readonly correctingCommentId = input<string | null>(null);
  readonly draftTip = signal('');
  readonly pinnedTopic = input<string | null>(null);
  readonly pinnedMessageId = input<string | null>(null);
  readonly topicChange = output<string>();
  readonly editingTopic = signal(false);
  readonly isHost = input(false);
  readonly canSend = input(true);

  readonly mutedUsers = input<ReadonlySet<string>>(new Set());
  readonly gifResults = input<readonly GifItem[]>([]);
  readonly gifLoading = input(false);
  readonly gifQuery = signal('');
  readonly searchGifs = output<string>();
  readonly sendGif = output<string>();
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
  readonly openProfile = output<DiscussionMessage>();

  readonly skeletonMessages = [
    { id: 1, authorWidth: '68px', lines: 2, hasReaction: false, isReply: false },
    { id: 2, authorWidth: '82px', lines: 2, hasReaction: true, isReply: false },
    { id: 3, authorWidth: '60px', lines: 1, hasReaction: false, isReply: true },
    { id: 4, authorWidth: '76px', lines: 2, hasReaction: true, isReply: false },
  ] as const;

  readonly reactionEmojis = REACTION_CATALOG;
  readonly activePickerReaction = signal<BackendReaction | null>(null);
  readonly hoveredChipKey = signal<string | null>(null);
  readonly burstingChipKeys = signal<ReadonlySet<string>>(new Set());
  readonly messageReactionBurst = signal<CommentReactionBurst | null>(null);
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
  private isAutoScrolling = false;
  private lastScrollTop = 0;
  private autoScrollTimer: ReturnType<typeof setTimeout> | null = null;

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
        const metrics = {
          scrollTop: scrollEl.scrollTop,
          scrollHeight: scrollEl.scrollHeight,
          clientHeight: scrollEl.clientHeight,
        };
        const latest = list.at(-1);
        return {
          scrollEl,
          bottom: metrics.scrollHeight,
          nearBottom: isNearChatBottom(metrics),
          scrollable: canScrollChat(metrics),
          messageCount: list.length,
          lastMessageId: latest?.id ?? null,
        };
      },
      write: (readResult) => {
        const snapshot = readResult();
        if (!snapshot) return;

        const { scrollEl, bottom, nearBottom, scrollable, messageCount, lastMessageId } = snapshot;
        const delta = Math.max(0, messageCount - this.lastMessageCount);
        const appended =
          delta > 0 || (lastMessageId !== null && lastMessageId !== this.lastBottomMessageId);
        this.lastMessageCount = messageCount;
        this.lastBottomMessageId = lastMessageId;

        if (!this.hasInitialScrolled) {
          this.hasInitialScrolled = true;
          scrollEl.scrollTop = bottom;
          this.lastScrollTop = scrollEl.scrollTop;
          this.showNewMessagesPill.set(false);
          this.unreadCount.set(0);
        } else if (
          this.forceScrollBottom ||
          (appended && (nearBottom || this.isAutoScrolling))
        ) {
          this.startProgrammaticScrollToBottom(scrollEl, bottom);
        } else if (appended) {
          this.showNewMessagesPill.set(true);
          this.unreadCount.update((count) => count + Math.max(1, delta));
        } else if (!scrollable) {
          this.showNewMessagesPill.set(false);
          this.unreadCount.set(0);
          this.clearAutoScroll();
        }
        this.forceScrollBottom = false;
      },
    });
    afterNextRender(() => {
      preloadNotoReactionAnimations();
    });

    this.destroyRef.onDestroy(() => {
      for (const timer of this.chipBurstTimers.values()) {
        clearTimeout(timer);
      }
      this.chipBurstTimers.clear();
      if (this.messageBurstTimer !== null) {
        clearTimeout(this.messageBurstTimer);
        this.messageBurstTimer = null;
      }
      this.clearAutoScroll();
    });
  }

  onReactionMenuOpened(): void {
    preloadNotoReactionAnimations();
  }

  commentActionsAriaLabel(author: string): string {
    return `Comment actions for ${author}'s message`;
  }

  canPinMessage(msg: DiscussionMessage): boolean {
    return canPinMessageToStage(msg);
  }

  canCorrectMessage(msg: DiscussionMessage): boolean {
    return canCorrectMessage(msg);
  }

  canCopyMessage(msg: DiscussionMessage): boolean {
    return canCopyMessage(msg);
  }

  hasCommentActions(msg: DiscussionMessage): boolean {
    return this.canSend() || this.isHost() || canCopyMessage(msg);
  }

  isEmojiActive(msg: DiscussionMessage, emoji: string): boolean {
    return msg.reactions.some((r) => r.emoji === emoji && r.active);
  }

  reactionKey(messageId: string, code: BackendReaction): string {
    return `${messageId}:${code}`;
  }

  setActivePickerReaction(code: BackendReaction): void {
    this.activePickerReaction.set(code);
  }

  clearActivePickerReaction(code?: BackendReaction): void {
    if (code === undefined || this.activePickerReaction() === code) {
      this.activePickerReaction.set(null);
    }
  }

  setHoveredChip(messageId: string, code: BackendReaction): void {
    this.hoveredChipKey.set(this.reactionKey(messageId, code));
  }

  clearHoveredChip(messageId: string, code: BackendReaction): void {
    const key = this.reactionKey(messageId, code);
    if (this.hoveredChipKey() === key) {
      this.hoveredChipKey.set(null);
    }
  }

  isChipBursting(messageId: string, code: BackendReaction): boolean {
    return this.burstingChipKeys().has(this.reactionKey(messageId, code));
  }

  isChipAnimated(messageId: string, code: BackendReaction): boolean {
    const key = this.reactionKey(messageId, code);
    return this.hoveredChipKey() === key || this.burstingChipKeys().has(key);
  }

  onToggleReactionChip(messageId: string, code: BackendReaction): void {
    if (!this.canSend()) return;
    this.triggerChipBurst(messageId, code);
    this.toggleReaction.emit({ messageId, reaction: code });
  }

  onPickCommentReaction(messageId: string, opt: ReactionPresentation): void {
    this.activePickerReaction.set(null);
    this.triggerChipBurst(messageId, opt.code);
    this.triggerMessageReactionBurst(messageId, opt);
    this.toggleReaction.emit({ messageId, reaction: opt.code });
  }

  private triggerChipBurst(messageId: string, code: BackendReaction): void {
    const key = this.reactionKey(messageId, code);
    const existing = this.chipBurstTimers.get(key);
    if (existing !== undefined) {
      clearTimeout(existing);
    }
    this.burstingChipKeys.update((prev): ReadonlySet<string> => new Set(prev).add(key));
    const timer = setTimeout(() => {
      this.chipBurstTimers.delete(key);
      this.burstingChipKeys.update((prev): ReadonlySet<string> => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, REACTION_BURST_DURATION_MS);
    this.chipBurstTimers.set(key, timer);
  }

  private triggerMessageReactionBurst(messageId: string, opt: ReactionPresentation): void {
    if (this.messageBurstTimer !== null) {
      clearTimeout(this.messageBurstTimer);
    }
    const id = ++this.messageBurstSeq;
    this.messageReactionBurst.set({ id, messageId, code: opt.code, emoji: opt.emoji });
    this.messageBurstTimer = setTimeout(() => {
      this.messageBurstTimer = null;
      if (this.messageReactionBurst()?.id === id) {
        this.messageReactionBurst.set(null);
      }
    }, ROOM_REACTION_LAUNCH_MS);
  }

  onReplyTo(message: DiscussionMessage): void {
    this.commentAction.emit({ action: 'reply', message });
    this.composerInputRef()?.nativeElement.focus();
  }

  onCorrectMessage(message: DiscussionMessage): void {
    if (!this.canCorrectMessage(message)) return;
    this.commentAction.emit({ action: 'correct', message });
    this.composerInputRef()?.nativeElement.focus();
  }

  onSaveTopic(event: Event, rawValue: string): void {
    event.preventDefault();
    const trimmed = sanitizeUserText(rawValue);
    if (!trimmed && !this.pinnedTopic()) {
      this.editingTopic.set(false);
      return;
    }
    this.topicChange.emit(trimmed);
    this.editingTopic.set(false);
  }

  clearReplyTarget(): void {
    this.draftTip.set('');
    this.replyCleared.emit();
  }

  consumeTip(): string | undefined {
    if (!this.correcting()) return undefined;
    const cleaned = sanitizeUserText(this.draftTip());
    return cleaned || undefined;
  }

  onTipInput(event: Event): void {
    const value = event.target instanceof HTMLInputElement ? event.target.value : '';
    this.draftTip.set(BLOCKED_IMAGE_PATTERN.test(value) ? '' : value);
  }

  onGifQueryInput(event: Event): void {
    const value = event.target instanceof HTMLInputElement ? event.target.value : '';
    this.gifQuery.set(value);
    this.searchGifs.emit(value);
  }

  onSelectGif(item: GifItem): void {
    this.forceScrollBottom = true;
    this.sendGif.emit(item.url);
    const scrollEl = this.discScrollRef()?.nativeElement;
    if (scrollEl) {
      this.startProgrammaticScrollToBottom(scrollEl);
    } else {
      this.showNewMessagesPill.set(false);
      this.unreadCount.set(0);
    }
    this.gifMenuTrigger()?.closeMenu();
  }

  onMediaLoad(): void {
    const scrollEl = this.discScrollRef()?.nativeElement;
    if (!scrollEl) return;
    const metrics = {
      scrollTop: scrollEl.scrollTop,
      scrollHeight: scrollEl.scrollHeight,
      clientHeight: scrollEl.clientHeight,
    };
    if (this.isAutoScrolling || isNearChatBottom(metrics, 160)) {
      this.startProgrammaticScrollToBottom(scrollEl);
    }
  }

  onOpenGifPicker(): void {
    if (this.gifResults().length === 0 && this.gifQuery().length === 0) {
      this.searchGifs.emit('');
    }
    this.gifSearchInputRef()?.nativeElement.focus();
  }

  onGifPickerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.gifMenuTrigger()?.closeMenu();
      return;
    }
    event.stopPropagation();
  }

  onEmojiRowKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const row = event.currentTarget as HTMLElement;
    const items = Array.from(row.querySelectorAll<HTMLButtonElement>('[mat-menu-item]'));
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1 || items.length === 0) return;

    event.preventDefault();
    event.stopPropagation();
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }

  onComposerPaste(event: ClipboardEvent): void {
    const clipboard = event.clipboardData;
    if (!clipboard) return;
    const hasImageFile =
      clipboard.files.length > 0 ||
      Array.from(clipboard.items).some((item) => item.kind === 'file' || item.type.startsWith('image/'));
    const pastedText = clipboard.getData('text/plain');
    if (hasImageFile || BLOCKED_IMAGE_PATTERN.test(pastedText)) {
      event.preventDefault();
    }
  }

  onComposerDrop(event: DragEvent): void {
    if (event.dataTransfer?.files?.length) {
      event.preventDefault();
      return;
    }
    const droppedText = event.dataTransfer?.getData('text/plain') ?? '';
    if (BLOCKED_IMAGE_PATTERN.test(droppedText)) {
      event.preventDefault();
    }
  }

  onSendMessage(event: Event): void {
    event.preventDefault();
    if (!this.canSend() || this.sending() || this.messageField().invalid()) return;
    const text = sanitizeUserText(this.draftMessage(), { allowNewlines: true });
    if (!text || BLOCKED_IMAGE_PATTERN.test(text)) {
      this.emptySendAttempt.emit();
      this.composerInputRef()?.nativeElement.focus();
      return;
    }
    this.forceScrollBottom = true;
    this.sendMessage.emit(text);
    const scrollEl = this.discScrollRef()?.nativeElement;
    if (scrollEl) {
      this.startProgrammaticScrollToBottom(scrollEl);
    } else {
      this.showNewMessagesPill.set(false);
      this.unreadCount.set(0);
    }
  }

  clearSentDraft(sent: string): void {
    if (sanitizeUserText(this.draftMessage(), { allowNewlines: true }) === sent) {
      this.draftMessage.set('');
      this.draftTip.set('');
    }
  }

  onComposerKey(event: KeyboardEvent): void {
    if (event.isComposing) return;
    if (event.key === 'Enter' && !event.shiftKey) this.onSendMessage(event);
    if (event.key === 'Escape') this.clearReplyTarget();
  }

  onScrollMessages(): void {
    const scrollEl = this.discScrollRef()?.nativeElement;
    if (!scrollEl) return;
    const next = resolveScrollPillState({
      metrics: {
        scrollTop: scrollEl.scrollTop,
        scrollHeight: scrollEl.scrollHeight,
        clientHeight: scrollEl.clientHeight,
      },
      previousScrollTop: this.lastScrollTop,
      isAutoScrolling: this.isAutoScrolling,
      currentUnreadCount: this.unreadCount(),
    });
    this.lastScrollTop = scrollEl.scrollTop;
    this.showNewMessagesPill.set(next.showPill);
    this.unreadCount.set(next.unreadCount);
    if (!next.isAutoScrolling) {
      this.clearAutoScroll();
    }
  }

  onJumpToNewest(): void {
    const scrollEl = this.discScrollRef()?.nativeElement;
    if (scrollEl) {
      this.startProgrammaticScrollToBottom(scrollEl);
    } else {
      this.showNewMessagesPill.set(false);
      this.unreadCount.set(0);
    }
  }

  private startProgrammaticScrollToBottom(el: HTMLDivElement, bottom = el.scrollHeight): void {
    this.showNewMessagesPill.set(false);
    this.unreadCount.set(0);
    this.isAutoScrolling = true;
    if (this.autoScrollTimer !== null) {
      clearTimeout(this.autoScrollTimer);
    }
    this.autoScrollTimer = setTimeout(() => {
      this.autoScrollTimer = null;
      this.isAutoScrolling = false;
    }, 650);
    this.scrollToBottomSmooth(el, bottom);
  }

  private clearAutoScroll(): void {
    this.isAutoScrolling = false;
    if (this.autoScrollTimer !== null) {
      clearTimeout(this.autoScrollTimer);
      this.autoScrollTimer = null;
    }
  }

  private scrollToBottomSmooth(el: HTMLDivElement, bottom = el.scrollHeight): void {
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top: bottom, behavior: 'smooth' });
    } else {
      el.scrollTop = bottom;
    }
  }
}
