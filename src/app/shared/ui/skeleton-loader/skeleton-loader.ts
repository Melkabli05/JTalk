import { Component, computed, input } from '@angular/core';
import {
  computeSkeletonLineWidths,
  resolveSkeletonHeight,
  SkeletonVariant,
} from './skeleton-loader.utils';

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

  readonly resolvedHeight = computed(() =>
    resolveSkeletonHeight(this.variant(), this.height()),
  );

  readonly lineWidths = computed(() =>
    computeSkeletonLineWidths(this.lines(), this.width()),
  );
}
