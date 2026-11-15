import { LiveAnnouncer } from '@angular/cdk/a11y';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
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
import { interval, type Observable } from 'rxjs';
import { IdentityService } from '@core/auth/identity.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { I18n } from '@shared/utils/i18n/i18n.service';
import { msg } from '@shared/utils/i18n/msg';
import { saveRequest } from '@shared/utils/save-request';
import { ParticipantsApiService } from '../../data-access/participants-api.service';
import { RealtimeService } from '../../data-access/realtime.service';
import { RoomsApiService } from '../../data-access/rooms-api.service';
import { StageApiService } from '../../data-access/stage-api.service';
import type { MemberRole, RoomEdit, Stage } from '../../models/room.model';
import { languageOf } from '@shared/utils/languages';
import { blockColors, memberOf } from '../../utils/members';
import { AudienceGridComponent } from '../../ui/audience-grid/audience-grid.component';
import { PersonDialogComponent } from '../../ui/person-dialog/person-dialog.component';
import { RaisedHandsComponent } from '../../ui/raised-hands/raised-hands.component';
import { RoomControlsComponent } from '../../ui/room-controls/room-controls.component';
import { RoomFormDialogComponent } from '../../ui/room-form-dialog/room-form-dialog.component';
import { StageSeatsComponent } from '../../ui/stage-seats/stage-seats.component';

const REFRESH_MS = 3000;

function statusOf(error: unknown): number | undefined {
  return error instanceof HttpErrorResponse ? error.status : undefined;
}

/**
 * Container: one room. Joins it, connects its audio, says "still here" and refreshes the stage and the people every few
 * seconds (and at once when the server announces a change), and turns what the person does (take a seat, raise a hand,
 * mute, leave) and what the host does (invite, remove, edit, end) into requests. Being removed by the host or the room
 * ending sends the person back to the hallway.
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
  providers: [ConfirmationService, RealtimeService],
  templateUrl: './room-page.component.html',
  styleUrl: './room-page.component.scss',
})
export default class RoomPageComponent {
  private readonly rooms = inject(RoomsApiService);
  private readonly participants = inject(ParticipantsApiService);
  private readonly stages = inject(StageApiService);
  protected readonly audio = inject(RealtimeService);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly toast = inject(MessageService);
  private readonly i18n = inject(I18n);
  private readonly identity = inject(IdentityService);
  private readonly announcer = inject(LiveAnnouncer);
  private left = false;
  private focused = false;
  private previous: Stage | null = null;
  private heardMicrophone = false;

  readonly id = input.required<string>();

  protected readonly room = this.rooms.roomResource(this.id);
  protected readonly stage = this.stages.stageResource(this.id);
  protected readonly people = this.participants.participantsResource(this.id);

  protected readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected readonly members = this.identity.directory;
  protected readonly meId = this.identity.userId;
  protected readonly joined = signal(false);
  protected readonly joining = saveRequest();
  protected readonly action = saveRequest();
  protected readonly saving = saveRequest();
  protected readonly editing = signal(false);
  protected readonly selectedId = signal<string | null>(null);

  protected readonly hostId = computed(() =>
    this.room.hasValue() ? this.room.value().hostId : '',
  );
  protected readonly isHost = computed(() => this.meId() !== null && this.meId() === this.hostId());
  protected readonly speakers = computed(() =>
    this.stage.hasValue() ? this.stage.value().speakers : [],
  );
  protected readonly queue = computed(() =>
    this.stage.hasValue() ? this.stage.value().handRaiseQueue : [],
  );
  protected readonly onStage = computed(() => this.speakers().includes(this.meId() ?? ''));
  protected readonly handRaised = computed(() => this.queue().includes(this.meId() ?? ''));
  protected readonly target = computed(() =>
    languageOf(this.room.hasValue() ? this.room.value().targetLanguage : ''),
  );
  protected readonly native = computed(() =>
    languageOf(this.room.hasValue() ? this.room.value().nativeLanguage : ''),
  );
  protected readonly colors = computed(() =>
    blockColors(this.room.hasValue() ? this.room.value().targetLanguage : ''),
  );

  private readonly present = computed(() => (this.people.hasValue() ? this.people.value() : []));
  protected readonly audience = computed(() => {
    const ids = new Set(this.present().map((person) => person.userId));
    const me = this.meId();
    if (this.joined() && me) {
      ids.add(me);
    }
    return [...ids].filter((id) => !this.speakers().includes(id));
  });
  protected readonly reconnecting = computed(() =>
    this.present()
      .filter((person) => person.reconnecting)
      .map((person) => person.userId),
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
      untracked(() => this.join(id));
    });
    effect(() => {
      if (statusOf(this.room.error()) === 404) {
        untracked(() => this.leaveAfter(msg('This room has ended.')));
      }
    });
    effect(() => {
      const stage = this.stage.hasValue() ? this.stage.value() : null;
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
    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.refresh());
    this.audio.roomEvents.pipe(takeUntilDestroyed()).subscribe(() => this.reloadAll());
    inject(DestroyRef).onDestroy(() => this.sayGoodbye());
  }

  protected leave(): void {
    this.sayGoodbye();
    void this.router.navigate(['/']);
  }

  protected raiseHand(): void {
    this.run(this.stages.raiseHand(this.id()), msg('Could not raise your hand. Please try again.'));
  }

  protected toggleMic(): void {
    void this.audio.toggleMicrophone();
  }

  protected enableSound(): void {
    void this.audio.enableSound();
  }

  protected retryAudio(): void {
    void this.audio.retry();
  }

  protected lowerHand(): void {
    this.run(this.stages.lowerHand(this.id()), msg('Could not lower your hand. Please try again.'));
  }

  protected takeSeat(): void {
    this.run(this.stages.takeSeat(this.id()), msg('Could not take the seat. Please try again.'));
  }

  protected invite(userId: string): void {
    this.selectedId.set(null);
    this.run(
      this.stages.promote(this.id(), userId),
      msg('Could not invite them. Please try again.'),
    );
  }

  protected demote(userId: string): void {
    this.selectedId.set(null);
    this.run(this.stages.demote(this.id(), userId), msg('Could not move them. Please try again.'));
  }

  protected stepDown(): void {
    this.selectedId.set(null);
    this.run(this.stages.leaveSeat(this.id()), msg('Could not step down. Please try again.'));
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
      accept: () =>
        this.run(
          this.participants.remove(this.id(), userId),
          msg('Could not remove them. Please try again.'),
        ),
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
      accept: () =>
        this.run(
          this.rooms.close(this.id()),
          msg('Could not end the room. Please try again.'),
          () => {
            this.left = true;
            void this.router.navigate(['/']);
          },
        ),
    });
  }

  protected edit(change: RoomEdit): void {
    this.saving.run(this.rooms.update(this.id(), change), {
      next: () => {
        this.editing.set(false);
        this.room.reload();
        this.toast.add({ severity: 'success', summary: this.i18n.t('The room was updated.') });
      },
      failure: msg('Could not save the room. Please try again.'),
    });
  }

  private join(id: string): void {
    this.joined.set(false);
    this.left = false;
    this.joining.run(this.participants.join(id), {
      next: (session) => {
        this.joined.set(true);
        void this.audio.connect(session);
      },
      failure: (error) =>
        statusOf(error) === 403
          ? msg('The host removed you from this room.')
          : statusOf(error) === 404
            ? msg('This room has ended.')
            : msg('Could not join the room. Please try again.'),
    });
  }

  private refresh(): void {
    if (!this.joined()) {
      return;
    }
    this.participants.heartbeat(this.id()).subscribe({
      error: (error: unknown) => {
        if (statusOf(error) === 403) {
          this.leaveAfter(msg('The host removed you from this room.'));
        } else if (statusOf(error) === 404) {
          this.leaveAfter(msg('This room has ended.'));
        }
      },
    });
    this.reloadAll();
  }

  private reloadAll(): void {
    this.room.reload();
    this.stage.reload();
    this.people.reload();
  }

  private run(request: Observable<void>, failure: string, after?: () => void): void {
    this.action.run(request, {
      next: () => {
        after?.();
        this.reloadAll();
      },
      failure,
    });
  }

  private leaveAfter(summary: string): void {
    if (this.left) {
      return;
    }
    this.left = true;
    this.joined.set(false);
    void this.audio.disconnect();
    this.toast.add({ severity: 'warn', summary: this.i18n.t(summary) });
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

  private sayGoodbye(): void {
    void this.audio.disconnect();
    if (this.joined() && !this.left) {
      this.left = true;
      this.participants.leave(this.id()).subscribe({ error: () => undefined });
    }
  }
}
