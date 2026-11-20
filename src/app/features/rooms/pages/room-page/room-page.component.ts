import { LiveAnnouncer } from '@angular/cdk/a11y';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  type Signal,
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
import { Menu } from '@openng/optimus-ui/menu';
import { Message } from '@openng/optimus-ui/message';
import { Skeleton } from '@openng/optimus-ui/skeleton';
import { Tag } from '@openng/optimus-ui/tag';
import { Chip } from '@openng/optimus-ui/chip';
import { Drawer } from '@openng/optimus-ui/drawer';
import { Tooltip } from '@openng/optimus-ui/tooltip';
import { PersonCardService } from '@core/people/person-card.service';
import type { RoomRole, RoomEdit, Stage } from '../../models/room.model';
import { RoomFacade } from '../../state/room.facade';
import { ChatPanelComponent } from '../../ui/chat-panel/chat-panel.component';
import { AudienceSectionComponent } from '../../ui/audience-section/audience-section.component';
import { PersonDialogComponent } from '../../ui/person-dialog/person-dialog.component';
import { RaisedHandsComponent } from '../../ui/raised-hands/raised-hands.component';
import { RoomControlsComponent } from '../../ui/room-controls/room-controls.component';
import { RoomFormDialogComponent } from '../../ui/room-form-dialog/room-form-dialog.component';
import { StageSeatsComponent } from '../../ui/stage-seats/stage-seats.component';
import { memberOf } from '../../utils/members';
import { roomLook } from '../../utils/room-look';

@Component({
  selector: 'app-room-page',
  imports: [
    AudienceSectionComponent,
    Badge,
    ButtonDirective,
    Card,
    ChatPanelComponent,
    ConfirmDialog,
    Drawer,
    Menu,
    NgTemplateOutlet,
    Message,
    PersonDialogComponent,
    RaisedHandsComponent,
    RoomControlsComponent,
    RoomFormDialogComponent,
    RouterLink,
    Skeleton,
    StageSeatsComponent,
    Tag,
    Chip,
    Tooltip,
  ],
  providers: [ConfirmationService, PersonCardService],
  templateUrl: './room-page.component.html',
  styleUrl: './room-page.component.scss',
})
export default class RoomPageComponent {
  protected readonly facade = inject(RoomFacade);
  protected readonly cards = inject(PersonCardService);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly toast = inject(MessageService);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly document = inject(DOCUMENT);
  private focused = false;
  private previous: Stage | null = null;
  private heardMicrophone = false;

  readonly id = input.required<string>();

  protected readonly state = this.facade.state;
  protected readonly wide = this.matching('(min-width: 1024px)');
  protected readonly beside = this.matching('(min-width: 80rem)');
  protected readonly phone = this.matching('(max-width: 40rem)');
  protected readonly modifier = /Mac|iPhone|iPad/.test(
    this.document.defaultView?.navigator.platform ?? '',
  )
    ? '⌘'
    : 'Ctrl';
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
  /** The page's actions behind the ⋯ button, which is what a phone shows instead of the buttons in the header. */
  protected readonly pageMenu = computed<MenuItem[]>(() => [
    { label: 'Share', icon: 'pi pi-share-alt', command: () => this.share() },
    ...(this.state.isHost()
      ? [
          {
            label: 'Edit the room',
            icon: 'pi pi-pencil',
            command: () => this.editing.set(true),
          },
          {
            label: 'End the room',
            icon: 'pi pi-stop-circle',
            linkClass: 'danger-item',
            command: () => this.end(),
          },
        ]
      : []),
  ]);
  protected readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  protected readonly editing = signal(false);
  protected readonly chatOpen = signal(false);
  protected readonly chat = this.facade.chat;
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
  /** There is a seat to give: inviting is not offered when the stage is full. */
  protected readonly seatFree = computed(
    () => this.state.speakers().length < (this.state.room()?.maxStageSeats ?? 0),
  );
  protected readonly canInvite = computed(
    () =>
      this.state.isHost() &&
      !this.selectedIsMe() &&
      this.selectedRole() === 'LISTENER' &&
      this.seatFree(),
  );
  /** Someone on the stage who is not the host may step down from the dock. */
  protected readonly canStepDownFromDock = computed(
    () => this.state.onStage() && !this.state.isHost(),
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
  protected readonly selectedSpeaking = computed(() =>
    this.facade.audio.speaking().includes(this.selectedId() ?? ''),
  );
  protected readonly selectedMuted = computed(() =>
    this.mutedIds().includes(this.selectedId() ?? ''),
  );
  protected readonly selectedCanMute = computed(() => {
    const id = this.selectedId();
    return id !== null && this.canMute(id);
  });
  /** Blocking is for anyone but yourself, once their profile has said who they are. */
  protected readonly selectedCanBlock = computed(() => {
    const card = this.cards.card();
    return card !== undefined && !card.isMe;
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
            summary: 'Your microphone is blocked. Allow it in your browser, then press Unmute.',
          }),
        );
      }
    });
    this.facade.exited.pipe(takeUntilDestroyed()).subscribe(() => this.leaveBecause());
  }

  private matching(query: string): Signal<boolean> {
    return toSignal(this.breakpoints.observe(query).pipe(map((result) => result.matches)), {
      initialValue: false,
    });
  }

  protected toggleChat(open: boolean): void {
    this.chatOpen.set(open);
    this.chat.watch(open);
  }

  protected copyText(text: string): void {
    void this.document.defaultView?.navigator.clipboard.writeText(text);
  }

  protected share(): void {
    const link = new URL(`/rooms/${this.id()}`, this.document.location.origin).href;
    void this.document.defaultView?.navigator.clipboard.writeText(link).then(
      () => this.toast.add({ severity: 'success', summary: 'Link copied.' }),
      () => this.toast.add({ severity: 'warn', summary: 'Could not copy the link.' }),
    );
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
      header: 'Remove from the room',
      message: `${name} will leave the room and cannot come back.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Remove',
      rejectLabel: 'Cancel',
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
      header: `Block ${name}`,
      message: `Blocking removes any follows between you and ${name}, and you will not find each other in search or partner suggestions.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Block',
      rejectLabel: 'Cancel',
      acceptButtonProps: { severity: 'danger' },
      accept: () =>
        this.cards.block(() => {
          this.selectedId.set(null);
          this.toast.add({
            severity: 'success',
            summary: `${name} is blocked.`,
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
      label: 'Mute',
      icon: 'pi pi-microphone pi-slashed',
      command: () => this.facade.mute(id),
    };
  }

  private moderationFor(id: string): MenuItem[] {
    const speaker = this.state.speakers().includes(id);
    const move: MenuItem[] = speaker
      ? [
          {
            label: 'Move to the audience',
            icon: 'pi pi-arrow-down',
            command: () => this.demote(id),
          },
        ]
      : this.seatFree()
        ? [
            {
              label: 'Invite to the stage',
              icon: 'pi pi-microphone',
              command: () => this.invite(id),
            },
          ]
        : [];
    return [
      ...(this.canMute(id) ? [this.muteItem(id)] : []),
      ...move,
      { separator: true },
      {
        label: 'Remove from the room',
        icon: 'pi pi-user-minus',
        linkClass: 'danger-item',
        command: () => this.remove(id),
      },
      {
        label: 'Block',
        icon: 'pi pi-ban',
        linkClass: 'danger-item',
        command: () => this.blockPerson(id),
      },
    ];
  }

  protected end(): void {
    this.confirmation.confirm({
      header: 'End the room',
      message: 'The room closes for everyone in it.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'End the room',
      rejectLabel: 'Cancel',
      acceptButtonProps: { severity: 'danger' },
      accept: () => this.facade.close(),
    });
  }

  protected edit(change: RoomEdit): void {
    this.facade.edit(change, () => {
      this.editing.set(false);
      this.toast.add({ severity: 'success', summary: 'The room was updated.' });
    });
  }

  /** Pushed out while looking at the room: back to the hallway. (The person is told why by the facade, wherever they are.) */
  private leaveBecause(): void {
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
        said.push('You raised your hand.');
      } else if (this.state.isHost()) {
        said.push(`${nameOf(id)} raised a hand.`);
      }
    }
    for (const id of stage.speakers.filter((speaker) => !before.speakers.includes(speaker))) {
      said.push(id === me ? 'You are now on stage.' : `${nameOf(id)} joined the stage.`);
    }
    for (const id of before.speakers.filter((speaker) => !stage.speakers.includes(speaker))) {
      said.push(id === me ? 'You moved to the audience.' : `${nameOf(id)} left the stage.`);
    }
    if (said.length > 0) {
      void this.announcer.announce(said.join(' '), 'polite');
    }
  }

  private announceMicrophone(on: boolean): void {
    if (on !== this.heardMicrophone) {
      this.heardMicrophone = on;
      void this.announcer.announce(
        on ? 'Your microphone is on.' : 'Your microphone is off.',
        'polite',
      );
    }
  }
}
