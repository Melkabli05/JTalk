import { Component, computed, input } from '@angular/core';
import { Avatar } from '@openng/optimus-ui/avatar';
import { InitialsPipe } from '@shared/pipes/initials.pipe';
import { avatarUrl } from '@shared/utils/avatars';
import { avatarColors } from '../../utils/members';
import type { Person } from '@core/auth/identity.models';

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

  protected readonly pictureSize = computed<'normal' | 'large' | 'xlarge'>(() => {
    const size = this.size();
    return size === 'hero' ? 'xlarge' : size;
  });
  protected readonly picture = computed(() => avatarUrl(this.member().avatar));
  protected readonly colors = computed(() => avatarColors(this.member().id));
}
