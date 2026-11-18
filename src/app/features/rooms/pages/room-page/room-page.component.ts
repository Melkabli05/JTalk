import { LiveAnnouncer } from '@angular/cdk/a11y';
import { BreakpointObserver } from '@angular/cdk/layout';
import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ConfirmationService, MessageService, type MenuItem } from '@openng/optimus-ui/api';
import { Badge } from '@openng/optimus-ui/badge';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Card } from '@openng/optimus-ui/card';
import { ConfirmDialog } from '@openng/optimus-ui/confirmdialog';
import { Message } from '@openng/optimus-ui/message';
import { Skeleton } from '@openng/optimus-ui/skeleton';
import { Tooltip } from '@openng/optimus-ui/tooltip';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { PersonCardService } from '@core/people/person-card.service';
import { I18n } from '@shared/utils/i18n/i18n.service';
import { msg } from '@shared/utils/i18n/msg';
import type { RoomRole, RoomEdit, Stage } from '../../models/room.model';
import { provideRoom, RoomFacade, type RoomExit } from '../../state/room.facade';
import { AudienceSectionComponent } from '../../ui/audience-section/audience-section.component';
import { PersonDialogComponent } from '../../ui/person-dialog/person-dialog.component';
import { RaisedHandsComponent } from '../../ui/raised-hands/raised-hands.component';
import { RoomControlsComponent } from '../../ui/room-controls/room-controls.component';
import { RoomFormDialogComponent } from '../../ui/room-form-dialog/room-form-dialog.component';
import { StageSeatsComponent } from '../../ui/stage-seats/stage-seats.component';
import { memberOf } from '../../utils/members';
import { roomLook } from '../../utils/room-look';

const EXIT_MESSAGES: Readonly<Record<RoomExit, string | null>> = {
  removed: msg('The host removed you from this room.'),
  ended: msg('This room has ended.'),
  closed: null,
};

@Component({
  selector: 'app-room-page',
  imports: [
    AudienceSectionComponent,
    Badge,
    ButtonDirective,
    Card,
    ConfirmDialog,
    Message,
    PersonDialogComponent,
    RaisedHandsComponent,
    RoomControlsComponent,
    RoomFormDialogComponent,
    RouterLink,
    Skeleton,
    StageSeatsComponent,
    Tooltip,
    TranslatePipe,
  ],
  providers: [ConfirmationService, PersonCardService, provideRoom()],
  templateUrl: './room-page.component.html',
  styleUrl: './room-page.component.scss',
})
export default class RoomPageComponent {
  protected readonly facade = inject(RoomFacade);
  protected readonly cards = inject(PersonCardService);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly toast = inject(MessageService);
  private readonly i18n = inject(I18n);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly breakpoints = inject(BreakpointObserver);
  protected readonly locale = this.i18n.locale;
  private focused = false;
  private previous: Stage | null = null;
  private heardMicrophone = false;

  readonly id = input.required<string>();

  protected readonly state = this.facade.state;
  protected readonly wide = toSignal(
    this.breakpoints.observe('(min-width: 1024px)').pipe(map((result) => result.matches)),
    { initialValue: false },
  );
  protected readonly look = computed(() => roomLook(this.state.room()));
  protected readonly host = computed(() => memberOf(this.state.members(), this.state.hostId()));
  protected readonly mutedIds = computed(() => {
    const me = this.state.meId();
    const audio = this.facade.audio;
    const mine =
      me !== null &&
      this.state.onStage() &&
      audio.canSpeak() &&
      audio.status() === 'connected' &&
      !audio.micOn();
    return mine && !audio.muted().includes(me) ? [...audio.muted(), me] : audio.muted();
  });
  protected readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  protected readonly editing = signal(false);
  protected readonly selectedId = signal<string | null>(null);

  protected readonly selected = computed(() => {
    const id = this.selectedId();
    return id === null ? undefined : memberOf(this.state.members(), id);
  });
  protected readonly selectedRole = computed<RoomRole>(() => {
    const id = this.selectedId();
    return id === this.state.hostId()
      ? 'HOST'
      : this.state.speakers().includes(id ?? '')
        ? 'SPEAKER'
        : 'LISTENER';
  });
  protected readonly selectedIsMe = computed(() => this.selectedId() === this.state.meId());
  protected readonly canInvite = computed(
    () => this.state.isHost() && !this.selectedIsMe() && this.selectedRole() === 'LISTENER',
  );
  protected readonly canDemote = computed(
    () => this.state.isHost() && this.selectedRole() === 'SPEAKER',
  );
  protected readonly canRemove = computed(() => this.state.isHost() && !this.selectedIsMe());
  /** What the host may do to each person from their seat: nobody gets a menu on the host or on themselves. */
  protected readonly moderation = computed<ReadonlyMap<string, readonly MenuItem[]>>(() => {
    if (!this.state.isHost()) {
      return new Map();
    }
    const others = [...this.state.speakers(), ...this.state.audience()].filter(
      (id) => id !== this.state.hostId() && id !== this.state.meId(),
    );
    return new Map(others.map((id) => [id, this.moderationFor(id)]));
  });
  protected readonly personActions = computed<MenuItem[]>(() => {
    const id = this.selectedId();
    const card = this.cards.card();
    if (id === null) {
      return [];
    }
    return [
      ...(this.canMute(id) ? [this.muteItem(id)] : []),
      ...(this.canRemove()
        ? [
            {
              label: this.i18n.t('Remove from the room'),
              icon: 'pi pi-user-minus',
              linkClass: 'danger-item',
              command: () => this.remove(id),
            },
          ]
        : []),
      ...(card !== undefined && !card.isMe
        ? [
            {
              label: this.i18n.t('Block'),
              icon: 'pi pi-ban',
              linkClass: 'danger-item',
              command: () => this.block(),
            },
          ]
        : []),
    ];
  });
  protected readonly canStepDown = computed(
    () => this.selectedIsMe() && this.selectedRole() === 'SPEAKER',
  );

  constructor() {
    effect(() => {
      this.cards.show(this.selectedId());
    });
    effect(() => {
      const id = this.id();
      untracked(() => this.facade.enter(id));
    });
    effect(() => {
      const stage = this.state.stage();
      if (stage) {
        untracked(() => this.announceChanges(stage));
      }
    });
    effect(() => {
      const heading = this.heading();
      if (heading && !this.focused) {
        this.focused = true;
        heading.nativeElement.focus();
      }
    });
    effect(() => {
      const on = this.facade.audio.micOn();
      untracked(() => this.announceMicrophone(on));
    });
    effect(() => {
      if (this.facade.audio.micRefused()) {
        untracked(() =>
          this.toast.add({
            severity: 'warn',
            summary: this.i18n.t(
              'Your microphone is blocked. Allow it in your browser, then press Unmute.',
            ),
          }),
        );
      }
    });
    this.facade.exited.pipe(takeUntilDestroyed()).subscribe((reason) => this.leaveBecause(reason));
  }

  protected leave(): void {
    this.facade.leave();
    void this.router.navigate(['/']);
  }

  protected invite(userId: string): void {
    this.selectedId.set(null);
    this.facade.invite(userId);
  }

  protected demote(userId: string): void {
    this.selectedId.set(null);
    this.facade.demote(userId);
  }

  protected stepDown(): void {
    this.selectedId.set(null);
    this.facade.stepDown();
  }

  protected remove(userId: string): void {
    this.selectedId.set(null);
    const name = memberOf(this.state.members(), userId).name;
    this.confirmation.confirm({
      header: this.i18n.t('Remove from the room'),
      message: this.i18n.t('{name} will leave the room and cannot come back.', { name }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.i18n.t('Remove'),
      rejectLabel: this.i18n.t('Cancel'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => this.facade.remove(userId),
    });
  }

  protected viewProfile(): void {
    const id = this.selectedId();
    this.selectedId.set(null);
    if (id !== null) {
      void this.router.navigate(id === this.state.meId() ? ['/profile'] : ['/people', id]);
    }
  }

  protected block(): void {
    const id = this.selectedId();
    if (id !== null) {
      this.blockPerson(id);
    }
  }

  private blockPerson(id: string): void {
    const name = memberOf(this.state.members(), id).name;
    this.confirmation.confirm({
      header: this.i18n.t('Block {name}', { name }),
      message: this.i18n.t(
        'Blocking removes any follows between you and {name}, and you will not find each other in search or partner suggestions.',
        { name },
      ),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.i18n.t('Block'),
      rejectLabel: this.i18n.t('Cancel'),
      acceptButtonProps: { severity: 'danger' },
      accept: () =>
        this.cards.block(() => {
          this.selectedId.set(null);
          this.toast.add({
            severity: 'success',
            summary: this.i18n.t('{name} is blocked.', { name }),
          });
        }, id),
    });
  }

  private canMute(id: string): boolean {
    return (
      this.state.isHost() &&
      id !== this.state.meId() &&
      this.state.speakers().includes(id) &&
      !this.facade.audio.muted().includes(id)
    );
  }

  private muteItem(id: string): MenuItem {
    return {
      label: this.i18n.t('Mute'),
      icon: 'pi pi-microphone pi-slashed',
      command: () => this.facade.mute(id),
    };
  }

  private moderationFor(id: string): MenuItem[] {
    const speaker = this.state.speakers().includes(id);
    return [
      ...(this.canMute(id) ? [this.muteItem(id)] : []),
      speaker
        ? {
            label: this.i18n.t('Move to the audience'),
            icon: 'pi pi-arrow-down',
            command: () => this.demote(id),
          }
        : {
            label: this.i18n.t('Invite to the stage'),
            icon: 'pi pi-microphone',
            command: () => this.invite(id),
          },
      { separator: true },
      {
        label: this.i18n.t('Remove from the room'),
        icon: 'pi pi-user-minus',
        linkClass: 'danger-item',
        command: () => this.remove(id),
      },
      {
        label: this.i18n.t('Block'),
        icon: 'pi pi-ban',
        linkClass: 'danger-item',
        command: () => this.blockPerson(id),
      },
    ];
  }

  protected end(): void {
    this.confirmation.confirm({
      header: this.i18n.t('End the room'),
      message: this.i18n.t('The room closes for everyone in it.'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.i18n.t('End the room'),
      rejectLabel: this.i18n.t('Cancel'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => this.facade.close(),
    });
  }

  protected edit(change: RoomEdit): void {
    this.facade.edit(change, () => {
      this.editing.set(false);
      this.toast.add({ severity: 'success', summary: this.i18n.t('The room was updated.') });
    });
  }

  private leaveBecause(reason: RoomExit): void {
    const summary = EXIT_MESSAGES[reason];
    if (summary) {
      this.toast.add({ severity: 'warn', summary: this.i18n.t(summary) });
    }
    void this.router.navigate(['/']);
  }

  private announceChanges(stage: Stage): void {
    const before = this.previous;
    this.previous = stage;
    if (!before) {
      return;
    }
    const me = this.state.meId();
    const nameOf = (id: string) => memberOf(this.state.members(), id).name;
    const said: string[] = [];
    for (const id of stage.handRaiseQueue.filter(
      (queued) => !before.handRaiseQueue.includes(queued),
    )) {
      if (id === me) {
        said.push(this.i18n.t('You raised your hand.'));
      } else if (this.state.isHost()) {
        said.push(this.i18n.t('{name} raised a hand.', { name: nameOf(id) }));
      }
    }
    for (const id of stage.speakers.filter((speaker) => !before.speakers.includes(speaker))) {
      said.push(
        id === me
          ? this.i18n.t('You are now on stage.')
          : this.i18n.t('{name} joined the stage.', { name: nameOf(id) }),
      );
    }
    for (const id of before.speakers.filter((speaker) => !stage.speakers.includes(speaker))) {
      said.push(
        id === me
          ? this.i18n.t('You moved to the audience.')
          : this.i18n.t('{name} left the stage.', { name: nameOf(id) }),
      );
    }
    if (said.length > 0) {
      void this.announcer.announce(said.join(' '), 'polite');
    }
  }

  private announceMicrophone(on: boolean): void {
    if (on !== this.heardMicrophone) {
      this.heardMicrophone = on;
      void this.announcer.announce(
        this.i18n.t(on ? msg('Your microphone is on.') : msg('Your microphone is off.')),
        'polite',
      );
    }
  }
}
