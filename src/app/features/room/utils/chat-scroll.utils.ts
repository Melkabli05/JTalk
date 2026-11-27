import { DiscussionMessage } from '../models/live-room.model';

export interface ChatScrollMetrics {
  readonly scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
}

export const CHAT_NEAR_BOTTOM_PX = 96;
export const CHAT_PILL_SHOW_PX = 80;
export const CHAT_AT_BOTTOM_PX = 24;

export function distanceFromChatBottom(metrics: ChatScrollMetrics): number {
  return Math.max(0, metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight);
}

export function isNearChatBottom(
  metrics: ChatScrollMetrics,
  thresholdPx = CHAT_NEAR_BOTTOM_PX,
): boolean {
  return distanceFromChatBottom(metrics) <= thresholdPx;
}

export function canScrollChat(metrics: ChatScrollMetrics): boolean {
  return metrics.scrollHeight - metrics.clientHeight > CHAT_AT_BOTTOM_PX;
}

export interface ScrollTransitionInput {
  readonly metrics: ChatScrollMetrics;
  readonly previousScrollTop: number;
  readonly isAutoScrolling: boolean;
  readonly currentUnreadCount: number;
}

export interface ScrollTransitionResult {
  readonly showPill: boolean;
  readonly unreadCount: number;
  readonly isAutoScrolling: boolean;
}

/**
 * Pure state machine for the floating "Latest messages" pill on scroll events.
 * Prevents the pill from flickering back on during programmatic smooth scrolls
 * to bottom, while immediately cancelling auto-scroll if the user scrolls up.
 */
export function resolveScrollPillState(input: ScrollTransitionInput): ScrollTransitionResult {
  const distance = distanceFromChatBottom(input.metrics);

  if (!canScrollChat(input.metrics) || distance <= CHAT_AT_BOTTOM_PX) {
    return {
      showPill: false,
      unreadCount: 0,
      isAutoScrolling: false,
    };
  }

  const userScrolledUp = input.metrics.scrollTop < input.previousScrollTop - 2;
  if (input.isAutoScrolling && !userScrolledUp) {
    return {
      showPill: false,
      unreadCount: 0,
      isAutoScrolling: true,
    };
  }

  const showPill = distance > CHAT_PILL_SHOW_PX;
  return {
    showPill,
    unreadCount: showPill ? input.currentUnreadCount : 0,
    isAutoScrolling: false,
  };
}

export function formatLatestMessagesLabel(unreadCount: number): string {
  if (unreadCount <= 0) return 'Latest messages';
  return unreadCount === 1 ? '1 new message' : `${unreadCount} new messages`;
}

/**
 * GIF messages cannot be pinned to the stage banner.
 */
export function canPinMessageToStage(message: Pick<DiscussionMessage, 'gifUrl'>): boolean {
  return !message.gifUrl;
}

/**
 * GIF messages cannot be language-corrected.
 */
export function canCorrectMessage(message: Pick<DiscussionMessage, 'gifUrl'>): boolean {
  return !message.gifUrl;
}

/**
 * GIF messages cannot be copied; only text/correction comments with text can be copied.
 */
export function canCopyMessage(message: Pick<DiscussionMessage, 'gifUrl' | 'text'>): boolean {
  return !message.gifUrl && Boolean(message.text);
}
