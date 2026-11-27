import { REACTION_CATALOG, type BackendReaction } from '../models/voice-room.model';

export const NOTO_EMOJI_CDN_BASE = 'https://fonts.gstatic.com/s/e/notoemoji/latest';

/** How long a click/tap reaction chip burst stays animated (ideal for mobile touch feedback). */
export const REACTION_BURST_DURATION_MS = 2200;

/** How long a room-picker launch floater animates above the React button on click/tap. */
export const ROOM_REACTION_LAUNCH_MS = 1450;

export interface NotoEmojiAssets {
  readonly codepoint: string;
  readonly staticSvgUrl: string;
  readonly animatedWebpUrl: string;
  readonly animatedGifUrl: string;
}

/**
 * Exhaustive mapping from each supported Jtalk `BackendReaction` to its verified
 * Google Fonts Noto Animated Emoji codepoint (`https://googlefonts.github.io/noto-emoji-animation/`).
 */
export const NOTO_REACTION_CODEPOINTS: Readonly<Record<BackendReaction, string>> = {
  THUMBS_UP: '1f44d',
  HEART: '2764_fe0f',
  LAUGH: '1f602',
  CLAP: '1f44f',
  FIRE: '1f525',
  PARTY: '1f389',
  SMILE: '1f60a',
  SPARKLES: '2728',
  WOW: '1f62e',
  THANKS: '1f64f',
};

function stripVariationSelector(value: string): string {
  return value.replaceAll('\ufe0f', '');
}

const CODEPOINT_BY_NORMALIZED_EMOJI = new Map<string, string>(
  REACTION_CATALOG.map((item) => [
    stripVariationSelector(item.emoji),
    NOTO_REACTION_CODEPOINTS[item.code],
  ]),
);

const ASSETS_CACHE = new Map<string, NotoEmojiAssets>();

export function notoCodepointForReaction(code: BackendReaction): string {
  return NOTO_REACTION_CODEPOINTS[code];
}

export function notoCodepointForEmoji(emoji: string): string | null {
  const normalized = stripVariationSelector(emoji.trim());
  return CODEPOINT_BY_NORMALIZED_EMOJI.get(normalized) ?? null;
}

export function notoEmojiAssets(codepoint: string): NotoEmojiAssets {
  const cached = ASSETS_CACHE.get(codepoint);
  if (cached) return cached;

  const base = `${NOTO_EMOJI_CDN_BASE}/${codepoint}`;
  const assets: NotoEmojiAssets = {
    codepoint,
    staticSvgUrl: `${base}/emoji.svg`,
    animatedWebpUrl: `${base}/512.webp`,
    animatedGifUrl: `${base}/512.gif`,
  };
  ASSETS_CACHE.set(codepoint, assets);
  return assets;
}

export function notoEmojiAssetsForReaction(code: BackendReaction): NotoEmojiAssets {
  return notoEmojiAssets(notoCodepointForReaction(code));
}

export function notoEmojiAssetsForEmoji(emoji: string): NotoEmojiAssets | null {
  const codepoint = notoCodepointForEmoji(emoji);
  return codepoint ? notoEmojiAssets(codepoint) : null;
}

let preloadedAnimations = false;

/**
 * Warms the browser cache with all 10 animated Noto WebP assets so first hover
 * or tap animates immediately on frame 1 with zero network pop-in or flicker.
 */
export function preloadNotoReactionAnimations(): void {
  if (preloadedAnimations || typeof window === 'undefined' || typeof Image === 'undefined') {
    return;
  }
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }
  preloadedAnimations = true;
  for (const item of REACTION_CATALOG) {
    const assets = notoEmojiAssetsForReaction(item.code);
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';
    img.src = assets.animatedWebpUrl;
  }
}
