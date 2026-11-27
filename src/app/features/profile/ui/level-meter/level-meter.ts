import { Component, computed, input } from '@angular/core';
import type { ProficiencyLevel } from '../../../../core/auth/auth.models';
import {
  formatProficiencyLevel,
  proficiencyBarsCount,
} from '../../utils/profile-format.utils';

const BAR_SLOTS: readonly number[] = [1, 2, 3, 4];

@Component({
  selector: 'app-level-meter',
  template: `
    <span class="level-meter" [attr.aria-label]="ariaLabel()" role="img">
      <span class="level-bars" aria-hidden="true">
        @for (slot of slots; track slot) {
          <span
            class="level-bar"
            [class.filled]="slot <= filledCount()"
            [attr.data-slot]="slot"
          ></span>
        }
      </span>
      @if (showLabel() && label(); as text) {
        <span class="level-label">{{ text }}</span>
      }
    </span>
  `,
  styleUrl: './level-meter.scss',
})
export class LevelMeter {
  readonly level = input<ProficiencyLevel | null | undefined>(null);
  readonly showLabel = input(true);

  readonly slots = BAR_SLOTS;
  readonly filledCount = computed(() => proficiencyBarsCount(this.level()));
  readonly label = computed(() => formatProficiencyLevel(this.level()));
  readonly ariaLabel = computed(() => {
    const text = this.label();
    return text ? `${text} (${this.filledCount()} of 4)` : 'Proficiency not set';
  });
}
