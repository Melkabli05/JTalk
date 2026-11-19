import {
  afterRenderEffect,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, FormRoot, form, maxLength, required } from '@angular/forms/signals';
import { NgOptimizedImage } from '@angular/common';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Message } from '@openng/optimus-ui/message';
import { Popover } from '@openng/optimus-ui/popover';
import { Skeleton } from '@openng/optimus-ui/skeleton';
import { Tag } from '@openng/optimus-ui/tag';
import { Tooltip } from '@openng/optimus-ui/tooltip';
import type { Person } from '@core/auth/identity.models';
import { TextFieldComponent } from '@shared/ui/text-field/text-field.component';
import { TextareaFieldComponent } from '@shared/ui/textarea-field/textarea-field.component';
import { formSubmission } from '@shared/utils/form-submission';
import { timeAgo } from '@shared/utils/time-ago';
import {
  COMMENT_MAX_LENGTH,
  TOPIC_MAX_LENGTH,
  type CommentDraft,
  type CommentTally,
  type RoomComment,
} from '../../models/chat.model';
import { REACTIONS, type Reaction } from '../../models/reaction.model';
import { memberOf } from '../../utils/members';
import { REACTION_LOOKS } from '../../utils/reactions';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';
import { ReactionPickerComponent } from '../reaction-picker/reaction-picker.component';

interface ComposerModel {
  content: string;
}

interface TopicModel {
  text: string;
}

const NEAR_BOTTOM_PX = 48;
const CLOCK_MS = 30_000;

@Component({
  selector: 'app-chat-panel',
  imports: [
    ButtonDirective,
    FormField,
    FormRoot,
    Message,
    NgOptimizedImage,
    PersonAvatarComponent,
    Popover,
    ReactionPickerComponent,
    Skeleton,
    Tag,
    TextareaFieldComponent,
    TextFieldComponent,
    Tooltip,
  ],
  templateUrl: './chat-panel.component.html',
  styleUrl: './chat-panel.component.scss',
})
export class ChatPanelComponent {
  readonly comments = input.required<readonly RoomComment[]>();
  readonly topic = input<string | null>(null);
  readonly ready = input(false);
  readonly failed = input(false);
  readonly muted = input(false);
  readonly mutedUsers = input<readonly string[]>([]);
  readonly members = input.required<ReadonlyMap<string, Person>>();
  readonly meId = input<string | null>(null);
  readonly isHost = input(false);
  readonly submitting = input(false);
  readonly error = input<string | null>(null);
  readonly moderating = input(false);
  readonly reactions = input<ReadonlyMap<string, CommentTally>>(new Map());
  readonly compact = input(false);
  readonly framed = input(false);

  readonly submitted = output<CommentDraft>();
  readonly deleted = output<string>();
  readonly muteRequested = output<string>();
  readonly unmuteRequested = output<string>();
  readonly pinned = output<string>();
  readonly unpinned = output<void>();
  readonly retry = output<void>();
  readonly expand = output<void>();
  readonly reacted = output<{ commentId: string; reaction: Reaction }>();

  protected readonly log = viewChild<ElementRef<HTMLElement>>('log');
  protected readonly stuck = signal(true);
  protected readonly replyingTo = signal<RoomComment | null>(null);
  protected readonly correcting = signal(false);
  protected readonly composer = signal<ComposerModel>({ content: '' });
  protected readonly topicDraft = signal<TopicModel>({ text: '' });

  protected readonly byId = computed(
    () => new Map(this.comments().map((comment) => [comment.id, comment])),
  );
  protected readonly muteIds = computed(() => new Set(this.mutedUsers()));
  protected readonly chips = computed(
    () =>
      new Map(
        [...this.reactions()].map(([commentId, tally]) => [
          commentId,
          REACTIONS.filter((reaction) => (tally.counts[reaction] ?? 0) > 0).map((reaction) => ({
            reaction,
            count: tally.counts[reaction] ?? 0,
            mine: tally.mine === reaction,
            label: REACTION_LOOKS[reaction].label,
            image: REACTION_LOOKS[reaction].image,
          })),
        ]),
      ),
  );
  private pickingFor: string | null = null;
  protected readonly now = signal(Date.now());
  protected readonly timeAgo = timeAgo;

  protected readonly composerForm = form(
    this.composer,
    (path) => {
      required(path.content, { message: 'Write something first.' });
      maxLength(path.content, COMMENT_MAX_LENGTH, { message: 'Use at most 500 characters.' });
    },
    {
      submission: formSubmission<ComposerModel>({
        busy: () => this.submitting() || this.muted(),
        submit: (value) => {
          const original = this.replyingTo();
          const text = value.content.trim();
          this.submitted.emit({
            type: original && this.correcting() ? 'CORRECTION' : 'TEXT',
            content: original && this.correcting() ? original.content : text,
            ...(original && this.correcting() ? { correctedContent: text } : {}),
            ...(this.replyingTo() ? { replyTo: this.replyingTo()?.id } : {}),
          });
        },
      }),
    },
  );

  protected readonly topicForm = form(
    this.topicDraft,
    (path) => {
      required(path.text, { message: 'Write the topic first.' });
      maxLength(path.text, TOPIC_MAX_LENGTH, { message: 'Use at most 200 characters.' });
    },
    {
      submission: formSubmission<TopicModel>({
        busy: () => this.moderating(),
        submit: (value) => {
          this.pinned.emit(value.text.trim());
          this.topicDraft.set({ text: '' });
        },
      }),
    },
  );

  private wasSubmitting = false;

  constructor() {
    effect(() => {
      const submitting = this.submitting();
      if (this.wasSubmitting && !submitting && this.error() === null) {
        this.composer.set({ content: '' });
        this.cancelReply();
      }
      this.wasSubmitting = submitting;
    });
    effect((onCleanup) => {
      const tick = setInterval(() => this.now.set(Date.now()), CLOCK_MS);
      onCleanup(() => clearInterval(tick));
    });
    afterRenderEffect(() => {
      this.comments();
      const element = this.log()?.nativeElement;
      if (element && this.stuck()) {
        element.scrollTop = element.scrollHeight;
      }
    });
  }

  protected nameOf(id: string): string {
    return memberOf(this.members(), id).name;
  }

  protected personOf(id: string): Person {
    return memberOf(this.members(), id);
  }

  protected quoted(comment: RoomComment): RoomComment | undefined {
    return comment.replyTo ? this.byId().get(comment.replyTo) : undefined;
  }

  protected reply(comment: RoomComment, correcting = false): void {
    this.replyingTo.set(comment);
    this.correcting.set(correcting);
  }

  protected cancelReply(): void {
    this.replyingTo.set(null);
    this.correcting.set(false);
  }

  protected scrolled(): void {
    const element = this.log()?.nativeElement;
    if (element) {
      this.stuck.set(
        element.scrollHeight - element.scrollTop - element.clientHeight <= NEAR_BOTTOM_PX,
      );
    }
  }

  protected pick(comment: RoomComment, event: Event, picker: Popover): void {
    this.pickingFor = comment.id;
    picker.toggle(event);
  }

  protected choose(reaction: Reaction, picker: Popover): void {
    if (this.pickingFor !== null) {
      this.reacted.emit({ commentId: this.pickingFor, reaction });
    }
    picker.hide();
  }

  protected jumpToLatest(): void {
    const element = this.log()?.nativeElement;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
    this.stuck.set(true);
  }
}
