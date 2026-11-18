import { DatePipe } from '@angular/common';
import { Component, computed, input, model, output } from '@angular/core';
import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionPanel,
} from '@openng/optimus-ui/accordion';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Dialog } from '@openng/optimus-ui/dialog';
import { Message } from '@openng/optimus-ui/message';
import { Skeleton } from '@openng/optimus-ui/skeleton';
import { Tag } from '@openng/optimus-ui/tag';
import { Tooltip } from '@openng/optimus-ui/tooltip';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { FollowButtonComponent } from '@shared/ui/follow-button/follow-button.component';
import { PartnerMatchComponent } from '@shared/ui/partner-match/partner-match.component';
import { SocialStatsComponent } from '@shared/ui/social-stats/social-stats.component';
import { msg } from '@shared/utils/i18n/msg';
import { languageOf } from '@shared/utils/languages';
import { countryNameOf, flagOf, PROFICIENCY_LABELS } from '@shared/utils/people';
import type { RoomRole } from '../../models/room.model';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';
import type { Person } from '@core/auth/identity.models';
import type { PersonCard } from '@core/people/person-card.model';

let nextId = 0;

/**
 * Someone in the room, as a card: where they are (the strip on top), who they are, what you can do about them (follow, and for the
 * host the tiles and the safety section), and what they have said about themselves. Everything it can do is an output; the room page
 * decides.
 */
@Component({
  selector: 'app-person-dialog',
  imports: [
    Accordion,
    AccordionContent,
    AccordionHeader,
    AccordionPanel,
    ButtonDirective,
    DatePipe,
    Dialog,
    FollowButtonComponent,
    Message,
    PartnerMatchComponent,
    PersonAvatarComponent,
    Skeleton,
    SocialStatsComponent,
    Tag,
    Tooltip,
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
  /** Heard right now. */
  readonly speaking = input(false);
  /** Their microphone is muted. */
  readonly muted = input(false);
  readonly canInvite = input(false);
  readonly canDemote = input(false);
  readonly canMute = input(false);
  readonly canStepDown = input(false);
  readonly canRemove = input(false);
  readonly canBlock = input(false);
  readonly card = input<PersonCard>();
  readonly loading = input(false);
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly locale = input('en');

  readonly invite = output<void>();
  readonly demote = output<void>();
  readonly mute = output<void>();
  readonly stepDown = output<void>();
  readonly remove = output<void>();
  readonly block = output<void>();
  readonly follow = output<void>();
  readonly unfollow = output<void>();
  readonly viewProfile = output<void>();

  protected readonly titleId = `app-person-${nextId++}`;
  protected readonly native = computed(() => languageOf(this.member()?.nativeLanguage ?? ''));
  protected readonly learning = computed(() => languageOf(this.member()?.learning ?? ''));
  protected readonly onStage = computed(() => this.role() !== 'LISTENER');
  protected readonly roleName = computed(() =>
    this.role() === 'HOST'
      ? msg('Host')
      : this.role() === 'SPEAKER'
        ? msg('Speaker')
        : msg('Listener'),
  );
  protected readonly placeName = computed(() =>
    this.onStage() ? msg('On stage') : msg('In the audience'),
  );
  /** What their microphone is doing, for someone on the stage. */
  protected readonly stateName = computed(() =>
    !this.onStage()
      ? ''
      : this.muted()
        ? msg('Muted')
        : this.speaking()
          ? msg('Speaking')
          : msg('On mic'),
  );
  protected readonly origin = computed(() => {
    const code = this.card()?.details.countryCode ?? '';
    return code === '' ? null : { flag: flagOf(code), name: countryNameOf(code, this.locale()) };
  });
  /** What they speak and learn, in one line: `Spanish (Native) · Arabic (Intermediate)`. */
  protected readonly languageLine = computed(() => {
    const languages = this.card()?.languages;
    if (languages === undefined) {
      return [];
    }
    return [
      ...languages.native.map((code) => ({
        ...languageOf(code),
        level: msg('Native'),
      })),
      ...languages.learning.map((entry) => ({
        ...languageOf(entry.code),
        level: entry.level === null ? '' : PROFICIENCY_LABELS[entry.level],
      })),
    ];
  });
}
