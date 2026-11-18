import { NgOptimizedImage } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { Avatar } from '@openng/optimus-ui/avatar';
import { InitialsPipe } from '@shared/pipes/initials.pipe';
import { avatarColors, avatarUrl } from '@shared/utils/avatars';
import type { Person } from '@core/auth/identity.models';
import type { FloatingReaction } from '../../models/reaction.model';
import { REACTION_LOOKS } from '../../utils/reactions';

@Component({
  selector: 'app-person-avatar',
  imports: [Avatar, InitialsPipe, NgOptimizedImage],
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
      <span class="ripple" aria-hidden="true"></span>
      <img
        class="reaction"
        aria-hidden="true"
        [ngSrc]="shown.image"
        width="32"
        height="32"
        priority
        alt=""
      />
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
      position: absolute;
      inset: 0;
      inline-size: 64%;
      block-size: 64%;
      margin: auto;
      filter: drop-shadow(0 0 1px var(--p-content-background))
        drop-shadow(0 0 1px var(--p-content-background))
        drop-shadow(0 1px 3px color-mix(in srgb, var(--p-text-color) 35%, transparent));
      pointer-events: none;

      @media (prefers-reduced-motion: no-preference) {
        animation: pop 2.4s linear forwards;
      }
    }

    .ripple {
      position: absolute;
      inset: 0;
      border: 2px solid var(--p-jtalk-brand);
      border-radius: 50%;
      pointer-events: none;

      @media (prefers-reduced-motion: no-preference) {
        animation: ripple 0.9s ease-out forwards;
      }

      @media (prefers-reduced-motion: reduce) {
        display: none;
      }
    }

    @keyframes pop {
      0% {
        opacity: 0;
        transform: scale(0.2) rotate(-14deg);
        animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      14% {
        opacity: 1;
        transform: scale(1) rotate(0);
      }

      22% {
        transform: scale(1.08) rotate(5deg);
        animation-timing-function: ease-in-out;
      }

      32% {
        transform: scale(1) rotate(-3deg);
      }

      42% {
        transform: scale(1) rotate(0);
      }

      85% {
        opacity: 1;
        transform: scale(1) translateY(0);
        animation-timing-function: ease-in;
      }

      100% {
        opacity: 0;
        transform: scale(0.85) translateY(-0.5rem);
      }
    }

    @keyframes ripple {
      from {
        opacity: 0.6;
        transform: scale(1);
      }

      to {
        opacity: 0;
        transform: scale(1.5);
      }
    }

    :host(.speaking) p-avatar {
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
      :host(.speaking) p-avatar {
        outline: 3px solid Highlight;
        outline-offset: 2px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      :host(.speaking) p-avatar {
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
    return reaction ? [{ id: reaction.id, image: REACTION_LOOKS[reaction.reaction].image }] : [];
  });
  protected readonly picture = computed(() => avatarUrl(this.member().avatar));
  protected readonly colors = computed(() => avatarColors(this.member().id));
}
