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
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Message } from '@openng/optimus-ui/message';
import { Skeleton } from '@openng/optimus-ui/skeleton';
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
  type RoomComment,
} from '../../models/chat.model';
import { memberOf } from '../../utils/members';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

interface ComposerModel {
  correcting: boolean;
  content: string;
  corrected: string;
}

interface TopicModel {
  text: string;
}

const NEAR_BOTTOM_PX = 48;
const COMPACT_MESSAGES = 3;
const CLOCK_MS = 30_000;

@Component({
  selector: 'app-chat-panel',
  imports: [
    ButtonDirective,
    FormField,
    FormRoot,
    Message,
    PersonAvatarComponent,
    Skeleton,
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
  readonly compact = input(false);

  readonly submitted = output<CommentDraft>();
  readonly deleted = output<string>();
  readonly muteRequested = output<string>();
  readonly unmuteRequested = output<string>();
  readonly pinned = output<string>();
  readonly unpinned = output<void>();
  readonly retry = output<void>();
  readonly expand = output<void>();

  protected readonly log = viewChild<ElementRef<HTMLElement>>('log');
  protected readonly stuck = signal(true);
  protected readonly replyingTo = signal<RoomComment | null>(null);
  protected readonly composer = signal<ComposerModel>({
    correcting: false,
    content: '',
    corrected: '',
  });
  protected readonly topicDraft = signal<TopicModel>({ text: '' });

  protected readonly byId = computed(
    () => new Map(this.comments().map((comment) => [comment.id, comment])),
  );
  protected readonly muteIds = computed(() => new Set(this.mutedUsers()));
  protected readonly shown = computed(() =>
    this.compact() ? this.comments().slice(-COMPACT_MESSAGES) : this.comments(),
  );
  protected readonly now = signal(Date.now());
  protected readonly timeAgo = timeAgo;

  protected readonly composerForm = form(
    this.composer,
    (path) => {
      required(path.content, { message: 'Write something first.' });
      maxLength(path.content, COMMENT_MAX_LENGTH, { message: 'Use at most 500 characters.' });
      required(path.corrected, {
        message: 'Write how it should be.',
        when: (field) => field.valueOf(path.correcting),
      });
      maxLength(path.corrected, COMMENT_MAX_LENGTH, { message: 'Use at most 500 characters.' });
    },
    {
      submission: formSubmission<ComposerModel>({
        busy: () => this.submitting() || this.muted(),
        submit: (value) => {
          const content = value.content.trim();
          const corrected = value.corrected.trim();
          this.submitted.emit({
            type: value.correcting ? 'CORRECTION' : 'TEXT',
            content,
            ...(value.correcting ? { correctedContent: corrected } : {}),
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
        this.composer.update((model) => ({ ...model, content: '', corrected: '' }));
        this.replyingTo.set(null);
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

  protected toggleCorrecting(): void {
    this.composer.update((model) => ({ ...model, correcting: !model.correcting }));
  }

  protected reply(comment: RoomComment): void {
    this.replyingTo.set(comment);
  }

  protected scrolled(): void {
    const element = this.log()?.nativeElement;
    if (element) {
      this.stuck.set(
        element.scrollHeight - element.scrollTop - element.clientHeight <= NEAR_BOTTOM_PX,
      );
    }
  }

  protected jumpToLatest(): void {
    const element = this.log()?.nativeElement;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
    this.stuck.set(true);
  }
}
