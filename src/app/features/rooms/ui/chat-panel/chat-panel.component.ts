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
import { Card } from '@openng/optimus-ui/card';
import { Divider } from '@openng/optimus-ui/divider';
import { Avatar } from '@openng/optimus-ui/avatar';
import { Drawer } from '@openng/optimus-ui/drawer';
import { Menu } from '@openng/optimus-ui/menu';
import type { MenuItem } from '@openng/optimus-ui/api';
import { Message } from '@openng/optimus-ui/message';
import { Popover } from '@openng/optimus-ui/popover';
import { Skeleton } from '@openng/optimus-ui/skeleton';
import { Tag } from '@openng/optimus-ui/tag';
import { Tooltip } from '@openng/optimus-ui/tooltip';
import type { Person } from '@core/auth/identity.models';
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
const EXCERPT_LENGTH = 48;
const LONG_PRESS_MS = 500;

@Component({
  selector: 'app-chat-panel',
  imports: [
    ButtonDirective,
    Avatar,
    Card,
    Divider,
    Drawer,
    Menu,
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
  readonly hostId = input<string | null>(null);
  readonly isHost = input(false);
  readonly submitting = input(false);
  readonly error = input<string | null>(null);
  readonly moderating = input(false);
  readonly reactions = input<ReadonlyMap<string, CommentTally>>(new Map());
  readonly compact = input(false);
  /** Whether the whole thread can be opened in the sheet (on a phone): the Expand button. */
  readonly expandable = input(false);
  readonly framed = input(false);

  readonly submitted = output<CommentDraft>();
  readonly deleted = output<string>();
  readonly muteRequested = output<string>();
  readonly unmuteRequested = output<string>();
  readonly topicPinned = output<string>();
  readonly topicUnpinned = output<void>();
  readonly commentPinned = output<string>();
  readonly commentUnpinned = output<string>();
  readonly retry = output<void>();
  readonly expand = output<void>();
  readonly reacted = output<{ commentId: string; reaction: Reaction }>();
  readonly textCopied = output<string>();
  readonly translateRequested = output<string>();

  protected readonly log = viewChild<ElementRef<HTMLElement>>('log');
  protected readonly stuck = signal(true);
  protected readonly replyingTo = signal<RoomComment | null>(null);
  protected readonly correcting = signal(false);
  protected readonly composer = signal<ComposerModel>({ content: '' });
  protected readonly topicDraft = signal<TopicModel>({ text: '' });
  private longPressTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** The message whose actions are open in the sheet. */
  protected readonly actionsFor = signal<RoomComment | null>(null);
  protected readonly actions = computed(() => {
    const comment = this.actionsFor();
    return comment === null ? [] : this.menuOf(comment);
  });
  protected readonly replies = computed(() => {
    const answers = new Map<string, RoomComment[]>();
    for (const comment of this.comments()) {
      if (comment.replyTo !== undefined && this.byId().has(comment.replyTo)) {
        answers.set(comment.replyTo, [...(answers.get(comment.replyTo) ?? []), comment]);
      }
    }
    return answers;
  });

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
  /** The column beside the room: messages are bubbles there, and cards under the room and in the sheet. */
  protected readonly side = computed(() => this.framed() && !this.compact());
  protected readonly composerValid = computed(() => this.composer().content.trim().length > 0);
  protected readonly now = signal(Date.now());
  protected readonly timeAgo = timeAgo;

  private readonly field = viewChild(TextareaFieldComponent);

  protected readonly composerForm = form(
    this.composer,
    (path) => {
      maxLength(path.content, COMMENT_MAX_LENGTH, { message: 'Use at most 500 characters.' });
    },
    {
      submission: formSubmission<ComposerModel>({
        busy: () => this.submitting() || this.muted(),
        submit: (value) => {
          const original = this.replyingTo();
          const text = value.content.trim();
          if (text === '') {
            return;
          }
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
          this.topicPinned.emit(value.text.trim());
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

  protected isPinned(comment: RoomComment): boolean {
    return !!comment.pinnedAt;
  }

  protected reply(comment: RoomComment, correcting = false): void {
    this.replyingTo.set(comment);
    this.correcting.set(correcting);
    this.field()?.focus();
  }

  protected cancelReply(): void {
    this.replyingTo.set(null);
    this.correcting.set(false);
    this.field()?.focus();
  }

  /** Enter sends and Shift+Enter starts a new line; Escape drops a reply or a correction in the making. */
  protected typing(event: KeyboardEvent, form: HTMLFormElement): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (this.composerValid()) {
        form.requestSubmit();
      }
    } else if (event.key === 'Escape' && this.replyingTo() !== null) {
      event.stopPropagation();
      this.cancelReply();
    }
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

  protected onCommentMouseDown(comment: RoomComment): void {
    if (!this.isHost()) return;

    const timer = setTimeout(() => {
      this.showPinOption(comment);
    }, LONG_PRESS_MS);

    this.longPressTimers.set(comment.id, timer);
  }

  protected onCommentMouseUp(commentId: string): void {
    const timer = this.longPressTimers.get(commentId);
    if (timer) {
      clearTimeout(timer);
      this.longPressTimers.delete(commentId);
    }
  }

  protected onCommentMouseLeave(commentId: string): void {
    const timer = this.longPressTimers.get(commentId);
    if (timer) {
      clearTimeout(timer);
      this.longPressTimers.delete(commentId);
    }
  }

  protected togglePin(comment: RoomComment): void {
    if (comment.pinnedAt) {
      this.commentUnpinned.emit(comment.id);
    } else {
      this.commentPinned.emit(comment.id);
    }
  }

  private showPinOption(comment: RoomComment): void {
    this.togglePin(comment);
  }

  /**
   * What can be done to a message, in the order of the owner's picture: reply, correct and pin (the host), copy, then (the host) mute and
   * delete. Choosing one closes the sheet.
   */
  protected menuOf(comment: RoomComment): MenuItem[] {
    const others = comment.authorId !== this.meId();
    const host = this.isHost() && others;
    const busy = this.moderating();
    const muted = this.muteIds().has(comment.authorId);
    const then = (action: () => void) => () => {
      this.actionsFor.set(null);
      action();
    };
    const items: (MenuItem | false)[] = [
      {
        label: 'Reply in thread',
        icon: 'pi pi-reply',
        command: then(() => this.reply(comment)),
      },
      !this.compact() &&
        comment.type === 'TEXT' &&
        others && {
          label: 'Correct',
          icon: 'pi pi-pencil',
          command: then(() => this.reply(comment, true)),
        },
      host && {
        label: this.isPinned(comment) ? 'Unpin from Stage' : 'Pin to Stage',
        icon: 'pi pi-thumbtack',
        badge: 'Host',
        disabled: busy,
        command: then(() => this.togglePin(comment)),
      },
      {
        label: 'Copy text',
        icon: 'pi pi-copy',
        command: then(() => this.textCopied.emit(comment.content)),
      },
      {
        label: 'Translate',
        icon: 'pi pi-language',
        command: then(() => this.translateRequested.emit(comment.content)),
      },
      host && { separator: true },
      host && {
        label: muted ? 'Unmute participant in room' : 'Mute participant in room',
        icon: 'pi pi-shield',
        disabled: busy,
        command: then(() =>
          muted
            ? this.unmuteRequested.emit(comment.authorId)
            : this.muteRequested.emit(comment.authorId),
        ),
      },
      host && {
        label: 'Delete comment',
        icon: 'pi pi-trash',
        linkClass: 'danger-item',
        disabled: busy,
        command: then(() => this.deleted.emit(comment.id)),
      },
    ];
    return items.filter((item): item is MenuItem => item !== false);
  }

  protected excerpt(comment: RoomComment): string {
    return comment.content.length > EXCERPT_LENGTH
      ? `${comment.content.slice(0, EXCERPT_LENGTH)}…`
      : comment.content;
  }

  protected repliesLabel(count: number): string {
    return count === 1 ? '1 reply' : `${count} replies`;
  }

  /** Takes the reader to the first answer to a message. */
  protected showReplies(answers: readonly RoomComment[]): void {
    const [first] = answers;
    if (first) {
      this.log()
        ?.nativeElement.querySelector(`[data-id="${first.id}"]`)
        ?.scrollIntoView?.({ block: 'center' });
    }
  }
}
