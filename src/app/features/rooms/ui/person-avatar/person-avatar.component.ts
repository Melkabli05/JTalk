import { Component, computed, input } from '@angular/core';
import { Avatar } from '@openng/optimus-ui/avatar';
import { InitialsPipe } from '@shared/pipes/initials.pipe';
import type { Member } from '../../models/room.model';
import { avatarColors } from '../../utils/members';

/** A person as a colored circle with their initials. Decorative: the name always sits next to it, so screen readers skip it. */
@Component({
  selector: 'app-person-avatar',
  imports: [Avatar, InitialsPipe],
  template: `<p-avatar
    shape="circle"
    aria-hidden="true"
    [label]="member().name | initials"
    [size]="size()"
    [style]="colors()"
  />`,
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

  protected readonly colors = computed(() => avatarColors(this.member().id));
}
