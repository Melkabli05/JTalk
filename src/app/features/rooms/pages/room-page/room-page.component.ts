import { LiveAnnouncer } from '@angular/cdk/a11y';
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from '@openng/optimus-ui/api';
import { Badge } from '@openng/optimus-ui/badge';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { ConfirmDialog } from '@openng/optimus-ui/confirmdialog';
import { Message } from '@openng/optimus-ui/message';
import { Skeleton } from '@openng/optimus-ui/skeleton';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { I18n } from '@shared/utils/i18n/i18n.service';
import { msg } from '@shared/utils/i18n/msg';
import { languageOf } from '@shared/utils/languages';
import type { MemberRole, RoomEdit, Stage } from '../../models/room.model';
import { provideRoom, RoomFacade, type RoomExit } from '../../state/room.facade';
import { AudienceGridComponent } from '../../ui/audience-grid/audience-grid.component';
import { PersonDialogComponent } from '../../ui/person-dialog/person-dialog.component';
import { RaisedHandsComponent } from '../../ui/raised-hands/raised-hands.component';
import { RoomControlsComponent } from '../../ui/room-controls/room-controls.component';
import { RoomFormDialogComponent } from '../../ui/room-form-dialog/room-form-dialog.component';
import { StageSeatsComponent } from '../../ui/stage-seats/stage-seats.component';
import { blockColors, memberOf } from '../../utils/members';

/** What to tell the person, when something other than their own choice took them out of the room. */
const EXIT_MESSAGES: Readonly<Record<RoomExit, string | null>> = {
  removed: msg('The host removed you from this room.'),
  ended: msg('This room has ended.'),
  closed: null,
};

/**
 * Container: one room. Everything that keeps the room alive (joining, the audio, refreshing, the requests) is the
 * `RoomFacade`'s; this page is what is on screen: which person is picked, the dialogs and confirmations, what screen
 * readers are told, and moving back to the hallway when the facade says the person is out.
 */
@Component({
  selector: 'app-room-page',
  imports: [
    AudienceGridComponent,
    Badge,
    ButtonDirective,
    ConfirmDialog,
    Message,
    PersonDialogComponent,
    RaisedHandsComponent,
    RoomControlsComponent,
    RoomFormDialogComponent,
    RouterLink,
    Skeleton,
    StageSeatsComponent,
    TranslatePipe,
  ],
  providers: [ConfirmationService, provideRoom()],
  templateUrl: './room-page.component.html',
  styleUrl: './room-page.component.scss',
})
export default class RoomPageComponent {
  private readonly facade = inject(RoomFacade);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly toast = inject(MessageService);
  private readonly i18n = inject(I18n);
  private readonly announcer = inject(LiveAnnouncer);
  private focused = false;
  private previous: Stage | null = null;
  private heardMicrophone = false;

  readonly id = input.required<string>();

  protected readonly state = this.facade.state;
  protected readonly audio = this.facade.audio;
  protected readonly room = this.state.room;
  protected readonly members = this.state.members;
  protected readonly meId = this.state.meId;
  protected readonly joined = this.state.joined;
  protected readonly hostId = this.state.hostId;
  protected readonly isHost = this.state.isHost;
  protected readonly speakers = this.state.speakers;
  protected readonly queue = this.state.queue;
  protected readonly onStage = this.state.onStage;
  protected readonly handRaised = this.state.handRaised;
  protected readonly audience = this.state.audience;
  protected readonly reconnecting = this.state.reconnecting;
  protected readonly joining = this.facade.joining;
  protected readonly action = this.facade.action;
  protected readonly saving = this.facade.saving;

  protected readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  protected readonly editing = signal(false);
  protected readonly selectedId = signal<string | null>(null);

  protected readonly target = computed(() =>
    languageOf(this.room.hasValue() ? this.room.value().targetLanguage : ''),
  );
  protected readonly native = computed(() =>
    languageOf(this.room.hasValue() ? this.room.value().nativeLanguage : ''),
  );
  protected readonly colors = computed(() =>
    blockColors(this.room.hasValue() ? this.room.value().targetLanguage : ''),
  );

  protected readonly selected = computed(() => {
    const id = this.selectedId();
    return id === null ? undefined : memberOf(this.members(), id);
  });
  protected readonly selectedRole = computed<MemberRole>(() => {
    const id = this.selectedId();
    return id === this.hostId()
      ? 'HOST'
      : this.speakers().includes(id ?? '')
        ? 'SPEAKER'
        : 'LISTENER';
  });
  protected readonly selectedIsMe = computed(() => this.selectedId() === this.meId());
  protected readonly canInvite = computed(
    () => this.isHost() && !this.selectedIsMe() && this.selectedRole() === 'LISTENER',
  );
  protected readonly canDemote = computed(() => this.isHost() && this.selectedRole() === 'SPEAKER');
  protected readonly canRemove = computed(() => this.isHost() && !this.selectedIsMe());
  protected readonly canStepDown = computed(
    () => this.selectedIsMe() && this.selectedRole() === 'SPEAKER',
  );

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.facade.enter(id));
    });
    effect(() => {
      const stage = this.state.stage.hasValue() ? this.state.stage.value() : null;
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
      const on = this.audio.micOn();
      untracked(() => this.announceMicrophone(on));
    });
    effect(() => {
      if (this.audio.micRefused()) {
        untracked(() =>
          this.toast.add({
            severity: 'warn',
            summary: this.i18n.t(
              'We could not use your microphone. Allow it in your browser, then press Unmute.',
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

  protected raiseHand(): void {
    this.facade.raiseHand();
  }

  protected lowerHand(): void {
    this.facade.lowerHand();
  }

  protected takeSeat(): void {
    this.facade.takeSeat();
  }

  protected toggleMic(): void {
    this.facade.toggleMicrophone();
  }

  protected enableSound(): void {
    this.facade.enableSound();
  }

  protected retryAudio(): void {
    this.facade.reconnectAudio();
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
    const name = memberOf(this.members(), userId).name;
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

  /** Tells screen readers what changed on the stage since the last look: who raised a hand, who got a seat, who gave it up. */
  private announceChanges(stage: Stage): void {
    const before = this.previous;
    this.previous = stage;
    if (!before) {
      return;
    }
    const me = this.meId();
    const nameOf = (id: string) => memberOf(this.members(), id).name;
    const said: string[] = [];
    for (const id of stage.handRaiseQueue.filter(
      (queued) => !before.handRaiseQueue.includes(queued),
    )) {
      if (id === me) {
        said.push(this.i18n.t('You raised your hand.'));
      } else if (this.isHost()) {
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

  /** Tells screen readers when the microphone goes on or off, since the button's look is the only other sign. */
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
