import assert from 'node:assert/strict';
import test from 'node:test';
import { BACKEND_REACTIONS, REACTION_CATALOG } from '../models/voice-room.model';
import {
  NOTO_EMOJI_CDN_BASE,
  NOTO_REACTION_CODEPOINTS,
  notoCodepointForEmoji,
  notoCodepointForReaction,
  notoEmojiAssets,
  notoEmojiAssetsForEmoji,
  notoEmojiAssetsForReaction,
} from './noto-emoji.utils';

test('every BackendReaction has a non-empty Noto Animated Emoji codepoint', () => {
  for (const code of BACKEND_REACTIONS) {
    const cp = notoCodepointForReaction(code);
    assert.ok(cp.length > 0, `Expected Noto codepoint for ${code}`);
    assert.equal(cp, NOTO_REACTION_CODEPOINTS[code]);
  }
});

test('every catalog emoji resolves back to its matching Noto Animated Emoji assets', () => {
  for (const item of REACTION_CATALOG) {
    const byCode = notoEmojiAssetsForReaction(item.code);
    const byEmoji = notoEmojiAssetsForEmoji(item.emoji);
    assert.ok(byEmoji, `Expected Noto assets for emoji ${item.emoji}`);
    assert.deepEqual(byEmoji, byCode);
    assert.equal(byEmoji.staticSvgUrl, `${NOTO_EMOJI_CDN_BASE}/${byCode.codepoint}/emoji.svg`);
    assert.equal(byEmoji.animatedWebpUrl, `${NOTO_EMOJI_CDN_BASE}/${byCode.codepoint}/512.webp`);
    assert.equal(byEmoji.animatedGifUrl, `${NOTO_EMOJI_CDN_BASE}/${byCode.codepoint}/512.gif`);
  }
});

test('notoCodepointForEmoji normalizes variation selectors and whitespace', () => {
  assert.equal(notoCodepointForEmoji('❤️'), '2764_fe0f');
  assert.equal(notoCodepointForEmoji('❤'), '2764_fe0f');
  assert.equal(notoCodepointForEmoji(' 👏 '), '1f44f');
});

test('notoCodepointForEmoji and notoEmojiAssetsForEmoji return null for unknown emojis', () => {
  assert.equal(notoCodepointForEmoji('🦄'), null);
  assert.equal(notoEmojiAssetsForEmoji(''), null);
});

test('notoEmojiAssets memoizes asset objects by codepoint', () => {
  const first = notoEmojiAssets('1f525');
  const second = notoEmojiAssets('1f525');
  assert.equal(first, second);
});
