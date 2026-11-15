import { Component, computed, input } from '@angular/core';
import { Avatar } from '@openng/optimus-ui/avatar';
import { InitialsPipe } from '@shared/pipes/initials.pipe';
import { avatarUrl } from '@shared/utils/avatars';
import type { Member } from '../../models/room.model';
import { avatarColors } from '../../utils/members';

/**
 * A person as their chosen picture, or, without one, a colored circle with their initials. Decorative: the name always
 * sits next to it, so screen readers skip it.
 */
@Component({
  selector: 'app-person-avatar',
  imports: [Avatar, InitialsPipe],
  template: `
    @if (picture(); as image) {
      <p-avatar shape="circle" aria-hidden="true" [image]="image" [size]="size()" />
    } @else {
      <p-avatar
        shape="circle"
        aria-hidden="true"
        [label]="member().name | initials"
        [size]="size()"
        [style]="colors()"
      />
    }
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    p-avatar {
      border: 2px solid var(--p-text-color);
    }
  `,
})
export class PersonAvatarComponent {
  readonly member = input.required<Member>();
  readonly size = input<'normal' | 'large' | 'xlarge'>('large');

  protected readonly picture = computed(() => avatarUrl(this.member().avatar));
  protected readonly colors = computed(() => avatarColors(this.member().id));
}
