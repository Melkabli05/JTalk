import { Component, computed, input } from '@angular/core';
import { Avatar } from '@openng/optimus-ui/avatar';
import { InitialsPipe } from '@shared/pipes/initials.pipe';
import { avatarUrl } from '@shared/utils/avatars';
import type { Member } from '../../models/room.model';
import { avatarColors } from '../../utils/members';

/**
 * A person as their chosen picture, or, without one, a colored circle with their initials. Decorative: the name always
 * sits next to it, so screen readers skip it. Speaking is a green ring plus a waveform badge, so it never relies on color.
 */
@Component({
  selector: 'app-person-avatar',
  imports: [Avatar, InitialsPipe],
  template: `
    @if (speaking()) {
      <span class="wave" aria-hidden="true"><i></i><i></i><i></i></span>
    }
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

    .wave {
      position: absolute;
      inset-block-end: -0.125rem;
      inset-inline-end: -0.125rem;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 2px;
      box-sizing: border-box;
      inline-size: 1.25rem;
      block-size: 1.25rem;
      border: 2px solid var(--p-content-background);
      border-radius: 50%;
      background: var(--p-primary-color);

      i {
        inline-size: 2px;
        border-radius: 999px;
        background: var(--p-primary-contrast-color);
        animation: wave 0.9s ease-in-out infinite;

        &:nth-child(1) {
          block-size: 4px;
        }

        &:nth-child(2) {
          block-size: 8px;
          animation-delay: 0.15s;
        }

        &:nth-child(3) {
          block-size: 6px;
          animation-delay: 0.3s;
        }
      }
    }

    @keyframes wave {
      50% {
        transform: scaleY(0.5);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      :host(.speaking) p-avatar,
      .wave i {
        animation: none;
      }
    }
  `,
})
export class PersonAvatarComponent {
  readonly member = input.required<Member>();
  /** `hero` is one avatar alone on a stage: larger than the scale's biggest. */
  readonly size = input<'normal' | 'large' | 'xlarge' | 'hero'>('large');
  /** Shown as a ring around the picture, with a waveform badge, while the person is heard. */
  readonly speaking = input(false);

  protected readonly pictureSize = computed<'normal' | 'large' | 'xlarge'>(() => {
    const size = this.size();
    return size === 'hero' ? 'xlarge' : size;
  });
  protected readonly picture = computed(() => avatarUrl(this.member().avatar));
  protected readonly colors = computed(() => avatarColors(this.member().id));
}
