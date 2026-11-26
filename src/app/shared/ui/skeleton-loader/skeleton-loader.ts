import { Component, computed, input } from '@angular/core';

export type SkeletonVariant = 'text' | 'circle' | 'pill' | 'rect';

const DEFAULT_HEIGHTS: Record<SkeletonVariant, string> = {
  text: '14px',
  circle: '36px',
  pill: '32px',
  rect: '40px',
};

@Component({
  selector: 'app-skeleton-loader',
  host: {
    class: 'skeleton-host',
    '[class.skeleton-stack]': 'lines() > 1',
    '[attr.role]': 'ariaLabel() ? "status" : null',
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.aria-hidden]': 'ariaLabel() ? null : "true"',
  },
  templateUrl: './skeleton-loader.html',
  styleUrl: './skeleton-loader.scss',
})
export class SkeletonLoader {
  readonly variant = input<SkeletonVariant>('text');
  readonly width = input('100%');
  readonly height = input<string | null>(null);
  readonly lines = input(1);
  readonly ariaLabel = input<string | null>(null);

  readonly resolvedHeight = computed(() => this.height() ?? DEFAULT_HEIGHTS[this.variant()]);

  readonly lineWidths = computed(() => {
    const count = Math.max(1, Math.floor(this.lines()));
    const width = this.width();
    if (count === 1) return [width];
    return Array.from({ length: count }, (_, i) => (i === count - 1 ? '78%' : width));
  });
}
