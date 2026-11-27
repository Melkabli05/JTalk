import { Component, computed, input, linkedSignal } from '@angular/core';
import type { BackendReaction } from '../../models/voice-room.model';
import {
  notoEmojiAssetsForEmoji,
  notoEmojiAssetsForReaction,
  type NotoEmojiAssets,
} from '../../utils/noto-emoji.utils';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

@Component({
  selector: 'app-animated-emoji',
  templateUrl: './animated-emoji.html',
  styleUrl: './animated-emoji.scss',
  host: {
    class: 'noto-animated-emoji',
    '[class.is-active]': 'active()',
    '[attr.data-animated]': 'shouldAnimate()',
    '[style.--noto-size.px]': 'size()',
  },
})
export class AnimatedEmoji {
  readonly emoji = input.required<string>();
  readonly code = input<BackendReaction | null>(null);
  readonly active = input(false);
  readonly size = input(24);
  readonly decorative = input(true);

  readonly assets = computed<NotoEmojiAssets | null>(() => {
    const code = this.code();
    return code ? notoEmojiAssetsForReaction(code) : notoEmojiAssetsForEmoji(this.emoji());
  });

  readonly staticFailed = linkedSignal({
    source: () => this.assets()?.codepoint ?? this.emoji(),
    computation: () => false,
  });

  readonly animatedFailed = linkedSignal({
    source: () => this.assets()?.codepoint ?? this.emoji(),
    computation: () => false,
  });

  readonly animatedLoaded = linkedSignal({
    source: () => (this.active() ? (this.assets()?.codepoint ?? null) : null),
    computation: () => false,
  });

  readonly shouldAnimate = computed(
    () =>
      this.active() &&
      this.assets() !== null &&
      !this.animatedFailed() &&
      !prefersReducedMotion(),
  );

  readonly showStaticSvg = computed(() => this.assets() !== null && !this.staticFailed());

  readonly imgAlt = computed(() => (this.decorative() ? '' : this.emoji()));
}
