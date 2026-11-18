import { DatePipe } from '@angular/common';
import { Component, computed, input, model, output } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Dialog } from '@openng/optimus-ui/dialog';
import { Message } from '@openng/optimus-ui/message';
import { Skeleton } from '@openng/optimus-ui/skeleton';
import { Tag } from '@openng/optimus-ui/tag';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { FollowButtonComponent } from '@shared/ui/follow-button/follow-button.component';
import { LanguageLevelsComponent } from '@shared/ui/language-levels/language-levels.component';
import { PartnerMatchComponent } from '@shared/ui/partner-match/partner-match.component';
import { SocialStatsComponent } from '@shared/ui/social-stats/social-stats.component';
import { languageOf } from '@shared/utils/languages';
import { countryNameOf, flagOf } from '@shared/utils/people';
import type { RoomRole } from '../../models/room.model';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';
import type { Person } from '@core/auth/identity.models';
import type { PersonCard } from '@core/people/person-card.model';

@Component({
  selector: 'app-person-dialog',
  imports: [
    ButtonDirective,
    DatePipe,
    Dialog,
    FollowButtonComponent,
    LanguageLevelsComponent,
    Message,
    PartnerMatchComponent,
    PersonAvatarComponent,
    Skeleton,
    SocialStatsComponent,
    Tag,
    TranslatePipe,
  ],
  templateUrl: './person-dialog.component.html',
  styleUrl: './person-dialog.component.scss',
})
export class PersonDialogComponent {
  readonly visible = model(false);
  readonly member = input<Person>();
  readonly role = input<RoomRole>('LISTENER');
  readonly isMe = input(false);
  readonly canInvite = input(false);
  readonly canDemote = input(false);
  readonly canRemove = input(false);
  readonly canStepDown = input(false);
  readonly card = input<PersonCard>();
  readonly loading = input(false);
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly locale = input('en');

  readonly invite = output<void>();
  readonly demote = output<void>();
  readonly remove = output<void>();
  readonly stepDown = output<void>();
  readonly follow = output<void>();
  readonly unfollow = output<void>();
  readonly block = output<void>();
  readonly viewProfile = output<void>();

  protected readonly native = computed(() => languageOf(this.member()?.nativeLanguage ?? ''));
  protected readonly learning = computed(() => languageOf(this.member()?.learning ?? ''));
  protected readonly anything = computed(
    () => this.canInvite() || this.canDemote() || this.canRemove() || this.canStepDown(),
  );
  protected readonly origin = computed(() => {
    const code = this.card()?.details.countryCode ?? '';
    return code === '' ? null : { flag: flagOf(code), name: countryNameOf(code, this.locale()) };
  });
}
