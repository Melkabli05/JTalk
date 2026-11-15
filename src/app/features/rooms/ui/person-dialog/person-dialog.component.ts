import { Component, computed, input, model, output } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Dialog } from '@openng/optimus-ui/dialog';
import { Tag } from '@openng/optimus-ui/tag';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import type { Member, MemberRole } from '../../models/room.model';
import { languageOf } from '@shared/utils/languages';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

/** Who someone is, and what the person looking at them may do about it. */
@Component({
  selector: 'app-person-dialog',
  imports: [ButtonDirective, Dialog, PersonAvatarComponent, Tag, TranslatePipe],
  templateUrl: './person-dialog.component.html',
  styleUrl: './person-dialog.component.scss',
})
export class PersonDialogComponent {
  readonly visible = model(false);
  readonly member = input<Member>();
  readonly role = input<MemberRole>('LISTENER');
  readonly isMe = input(false);
  readonly canInvite = input(false);
  readonly canDemote = input(false);
  readonly canRemove = input(false);
  readonly canStepDown = input(false);

  readonly invite = output<void>();
  readonly demote = output<void>();
  readonly remove = output<void>();
  readonly stepDown = output<void>();

  protected readonly native = computed(() => languageOf(this.member()?.nativeLanguage ?? ''));
  protected readonly learning = computed(() => languageOf(this.member()?.learning ?? ''));
  protected readonly anything = computed(
    () => this.canInvite() || this.canDemote() || this.canRemove() || this.canStepDown(),
  );
}
