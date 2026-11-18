import { Component, computed, input } from '@angular/core';
import { Avatar } from '@openng/optimus-ui/avatar';
import { InitialsPipe } from '@shared/pipes/initials.pipe';
import { avatarUrl } from '@shared/utils/avatars';
import { avatarColors } from '../../utils/members';
import type { Person } from '@core/auth/identity.models';
import type { FloatingReaction } from '../../models/reaction.model';
import { REACTION_LOOKS } from '../../utils/reactions';

@Component({
  selector: 'app-person-avatar',
  imports: [Avatar, InitialsPipe],
  template: `
    @if (picture(); as image) {
      <p-avatar shape="circle" aria-hidden="true" [image]="image" [size]="pictureSize()" />
    } @else {
      <p-avatar
        shape="circle"
        aria-hidden="true"
        [label]="member().name | initials"
        [size]="pictureSize()"
        [style]="colors()"
      />
    }
    @for (shown of shown(); track shown.id) {
      <p-avatar class="reaction" shape="circle" aria-hidden="true" [icon]="shown.icon" />
    }
  `,
  host: { '[class.speaking]': 'speaking()', '[class.hero]': "size() === 'hero'" },
  styles: `
    :host {
      position: relative;
      display: inline-flex;
    }

    :host(.hero) p-avatar {
      --p-avatar-xl-width: 7.5rem;
      --p-avatar-xl-height: 7.5rem;
      --p-avatar-xl-font-size: 2.5rem;
    }

    .reaction {
      --p-avatar-background: var(--p-content-background);
      --p-avatar-color: var(--p-text-color);
      --p-avatar-width: 1.75rem;
      --p-avatar-height: 1.75rem;
      --p-avatar-font-size: 0.875rem;
      position: absolute;
      inset-block-start: -0.5rem;
      inset-inline-end: -0.625rem;
      box-shadow: 0 0 0 2px var(--p-content-background);

      @media (prefers-reduced-motion: no-preference) {
        animation: pop 2.4s ease-out forwards;
      }
    }

    @keyframes pop {
      from {
        opacity: 0;
        transform: scale(0.4);
      }

      10% {
        opacity: 1;
        transform: scale(1.2);
      }

      18% {
        transform: scale(1);
      }

      85% {
        opacity: 1;
      }

      to {
        opacity: 0;
      }
    }

    :host(.speaking) p-avatar:not(.reaction) {
      box-shadow:
        0 0 0 3px var(--p-content-background),
        0 0 0 5px var(--p-jtalk-brand);
      animation: speaking 1.6s ease-in-out infinite;
    }

    @keyframes speaking {
      50% {
        box-shadow:
          0 0 0 3px var(--p-content-background),
          0 0 0 8px color-mix(in srgb, var(--p-jtalk-brand) 45%, transparent);
      }
    }

    @media (forced-colors: active) {
      :host(.speaking) p-avatar:not(.reaction) {
        outline: 3px solid Highlight;
        outline-offset: 2px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      :host(.speaking) p-avatar:not(.reaction) {
        animation: none;
      }
    }
  `,
})
export class PersonAvatarComponent {
  readonly member = input.required<Person>();
  readonly size = input<'normal' | 'large' | 'xlarge' | 'hero'>('large');
  readonly speaking = input(false);
  readonly reaction = input<FloatingReaction | null>(null);

  protected readonly pictureSize = computed<'normal' | 'large' | 'xlarge'>(() => {
    const size = this.size();
    return size === 'hero' ? 'xlarge' : size;
  });
  protected readonly shown = computed(() => {
    const reaction = this.reaction();
    return reaction ? [{ id: reaction.id, icon: REACTION_LOOKS[reaction.reaction].icon }] : [];
  });
  protected readonly picture = computed(() => avatarUrl(this.member().avatar));
  protected readonly colors = computed(() => avatarColors(this.member().id));
}
