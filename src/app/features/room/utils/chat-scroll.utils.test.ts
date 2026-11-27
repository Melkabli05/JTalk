import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canCopyMessage,
  canCorrectMessage,
  canPinMessageToStage,
  canScrollChat,
  distanceFromChatBottom,
  formatLatestMessagesLabel,
  isNearChatBottom,
  resolveScrollPillState,
} from './chat-scroll.utils';

test('distanceFromChatBottom and isNearChatBottom compute bottom clearance accurately', () => {
  assert.equal(
    distanceFromChatBottom({ scrollTop: 650, scrollHeight: 1000, clientHeight: 300 }),
    50,
  );
  assert.equal(
    isNearChatBottom({ scrollTop: 650, scrollHeight: 1000, clientHeight: 300 }),
    true,
  );
  assert.equal(
    isNearChatBottom({ scrollTop: 400, scrollHeight: 1000, clientHeight: 300 }),
    false,
  );
  assert.equal(
    canScrollChat({ scrollTop: 0, scrollHeight: 310, clientHeight: 300 }),
    false,
  );
});

test('resolveScrollPillState keeps pill hidden during programmatic smooth scroll down', () => {
  const state = resolveScrollPillState({
    metrics: { scrollTop: 220, scrollHeight: 1000, clientHeight: 300 },
    previousScrollTop: 120,
    isAutoScrolling: true,
    currentUnreadCount: 0,
  });
  assert.deepEqual(state, {
    showPill: false,
    unreadCount: 0,
    isAutoScrolling: true,
  });
});

test('resolveScrollPillState cancels auto-scroll when user scrolls back up manually', () => {
  const state = resolveScrollPillState({
    metrics: { scrollTop: 180, scrollHeight: 1000, clientHeight: 300 },
    previousScrollTop: 260,
    isAutoScrolling: true,
    currentUnreadCount: 0,
  });
  assert.deepEqual(state, {
    showPill: true,
    unreadCount: 0,
    isAutoScrolling: false,
  });
});

test('resolveScrollPillState clears unread count and hides pill once near bottom', () => {
  const state = resolveScrollPillState({
    metrics: { scrollTop: 685, scrollHeight: 1000, clientHeight: 300 },
    previousScrollTop: 500,
    isAutoScrolling: false,
    currentUnreadCount: 4,
  });
  assert.deepEqual(state, {
    showPill: false,
    unreadCount: 0,
    isAutoScrolling: false,
  });
});

test('resolveScrollPillState preserves unread count while scrolled up away from bottom', () => {
  const state = resolveScrollPillState({
    metrics: { scrollTop: 200, scrollHeight: 1000, clientHeight: 300 },
    previousScrollTop: 250,
    isAutoScrolling: false,
    currentUnreadCount: 3,
  });
  assert.deepEqual(state, {
    showPill: true,
    unreadCount: 3,
    isAutoScrolling: false,
  });
});

test('formatLatestMessagesLabel formats zero, singular, and plural unread counts', () => {
  assert.equal(formatLatestMessagesLabel(0), 'Latest messages');
  assert.equal(formatLatestMessagesLabel(1), '1 new message');
  assert.equal(formatLatestMessagesLabel(5), '5 new messages');
});

test('GIF messages cannot be pinned, corrected, or copied', () => {
  const textMsg = { text: 'Hello room', gifUrl: undefined };
  const gifMsg = { text: '', gifUrl: 'https://media.tenor.com/example.gif' };

  assert.equal(canPinMessageToStage(textMsg), true);
  assert.equal(canPinMessageToStage(gifMsg), false);
  assert.equal(canCorrectMessage(textMsg), true);
  assert.equal(canCorrectMessage(gifMsg), false);
  assert.equal(canCopyMessage(textMsg), true);
  assert.equal(canCopyMessage(gifMsg), false);
});
