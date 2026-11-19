import { NgOptimizedImage } from '@angular/common';
import { Component, output } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Tooltip } from '@openng/optimus-ui/tooltip';
import { REACTIONS, type Reaction } from '../../models/reaction.model';
import { REACTION_LOOKS } from '../../utils/reactions';

/** The ten reactions as icon buttons in two rows, for a popover: one is chosen by pressing it. */
@Component({
  selector: 'app-reaction-picker',
  imports: [ButtonDirective, NgOptimizedImage, Tooltip],
  template: `
    <div class="reactions">
      @for (item of looks; track item.reaction) {
        @let label = item.label;
        <button
          pButton
          type="button"
          size="large"
          class="reaction-choice"
          [text]="true"
          [rounded]="true"
          [attr.aria-label]="label"
          [pTooltip]="label"
          tooltipPosition="top"
          (click)="chosen.emit(item.reaction)"
        >
          <img [ngSrc]="item.image" width="28" height="28" alt="" />
        </button>
      }
    </div>
  `,
  styles: `
    .reactions {
      display: grid;
      grid-template-columns: repeat(5, 3rem);
      gap: 0.25rem;
    }

    button.reaction-choice {
      padding: 0;
      inline-size: 3rem;
      block-size: 3rem;

      img {
        inline-size: 1.75rem;
        block-size: 1.75rem;
      }
    }
  `,
})
export class ReactionPickerComponent {
  readonly chosen = output<Reaction>();

  protected readonly looks = REACTIONS.map((reaction) => ({
    reaction,
    ...REACTION_LOOKS[reaction],
  }));
}
