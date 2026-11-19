import { Component, computed, input, output } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Message } from '@openng/optimus-ui/message';
import { OverlayBadge } from '@openng/optimus-ui/overlaybadge';
import { Popover } from '@openng/optimus-ui/popover';
import { Toolbar } from '@openng/optimus-ui/toolbar';
import { Tooltip } from '@openng/optimus-ui/tooltip';
import type { Reaction } from '../../models/reaction.model';
import type { AudioStatus } from '../../models/realtime.model';
import { ReactionPickerComponent } from '../reaction-picker/reaction-picker.component';

let nextId = 0;

@Component({
  selector: 'app-room-controls',
  imports: [
    ButtonDirective,
    Message,
    OverlayBadge,
    Popover,
    ReactionPickerComponent,
    Toolbar,
    Tooltip,
  ],
  template: `
    <span class="cdk-visually-hidden" [id]="labelId">Room controls</span>
    <div class="notes">
      @if (audio() === 'connecting') {
        <p class="connecting" role="status">
          <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
          Connecting audio…
        </p>
      }
      @if (audio() === 'reconnecting') {
        <p-message severity="warn" size="small" icon="pi pi-spin pi-spinner"
          >Reconnecting… trying to restore your connection.</p-message
        >
      }
      @if (audio() === 'failed') {
        <p-message severity="error" size="small" icon="pi pi-exclamation-triangle">
          <span class="message">
            Audio is not available.
            <button
              pButton
              type="button"
              size="small"
              icon="pi pi-refresh"
              severity="danger"
              [text]="true"
              label="Reconnect audio"
              (click)="retryAudio.emit()"
            ></button>
          </span>
        </p-message>
      }
      @if (micRefused()) {
        <p-message severity="warn" size="small" icon="pi pi-exclamation-triangle"
          >Your microphone is blocked. Allow it in your browser, then press Unmute.</p-message
        >
      }
      @if (soundBlocked()) {
        <p-message severity="info" size="small" icon="pi pi-volume-off">
          <span class="message">
            Sound is off in this browser.
            <button
              pButton
              type="button"
              size="small"
              icon="pi pi-volume-up"
              [text]="true"
              label="Turn on sound"
              (click)="enableSound.emit()"
            ></button>
          </span>
        </p-message>
      }
      @if (handRaised() && !onStage() && !micRefused()) {
        <p class="hint" role="status">
          <i class="pi pi-hand" aria-hidden="true"></i>
          Waiting for the host to let you speak. Tap the hand again to cancel.
        </p>
      }
    </div>
    <p-toolbar [ariaLabelledBy]="labelId" [attr.aria-busy]="busy()">
      <ng-template #center>
        <div class="controls">
          @if (micShown()) {
            @let micLabel = micOn() ? 'Mute' : 'Unmute';
            <button
              pButton
              type="button"
              class="mic"
              size="large"
              [icon]="micOn() ? 'pi pi-microphone' : 'pi pi-microphone pi-slashed'"
              [severity]="micOn() ? 'primary' : 'secondary'"
              [outlined]="!micOn()"
              [rounded]="true"
              [attr.aria-label]="micLabel"
              [pTooltip]="micLabel"
              tooltipPosition="top"
              (click)="toggleMic.emit()"
            ></button>
          }
          @if (canStepDown()) {
            @let stepLabel = 'Step down to the audience';
            <button
              pButton
              type="button"
              class="step"
              size="large"
              icon="pi pi-arrow-down"
              severity="secondary"
              [outlined]="true"
              [rounded]="true"
              [disabled]="busy()"
              [attr.aria-label]="stepLabel"
              [pTooltip]="stepLabel"
              tooltipPosition="top"
              (click)="stepDown.emit()"
            ></button>
          }
          @if (!onStage()) {
            <button
              pButton
              type="button"
              class="hand"
              size="large"
              icon="pi pi-hand"
              severity="primary"
              [outlined]="handRaised()"
              [rounded]="true"
              [disabled]="busy()"
              label="Raise hand"
              aria-label="Raise hand"
              [attr.aria-pressed]="handRaised()"
              (click)="handRaised() ? lowerHand.emit() : raiseHand.emit()"
            ></button>
          }
          @if (chatShown()) {
            <p-overlay-badge
              [value]="unread() > 0 ? unread() : null"
              [badgeDisabled]="unread() === 0"
              badgeSize="small"
              severity="danger"
            >
              <button
                pButton
                type="button"
                size="large"
                icon="pi pi-comments"
                severity="secondary"
                [outlined]="true"
                [rounded]="true"
                [attr.aria-label]="chatLabel()"
                [pTooltip]="chatLabel()"
                tooltipPosition="top"
                (click)="chat.emit()"
              ></button>
            </p-overlay-badge>
          }
          @let reactLabel = 'React';
          <button
            pButton
            type="button"
            class="react"
            size="large"
            icon="pi pi-face-smile"
            severity="secondary"
            [outlined]="true"
            [rounded]="true"
            [attr.aria-label]="reactLabel"
            [pTooltip]="reactLabel"
            tooltipPosition="top"
            (click)="picker.toggle($event)"
          ></button>
          @if (isHost()) {
            @let editLabel = 'Edit the room';
            <button
              pButton
              type="button"
              class="host-action room-edit"
              size="large"
              icon="pi pi-pencil"
              severity="secondary"
              [outlined]="true"
              [rounded]="true"
              [attr.aria-label]="editLabel"
              [pTooltip]="editLabel"
              tooltipPosition="top"
              (click)="editRoom.emit()"
            ></button>
            @let endLabel = 'End the room';
            <button
              pButton
              type="button"
              class="host-action room-end"
              size="large"
              icon="pi pi-stop-circle"
              severity="danger"
              [outlined]="true"
              [rounded]="true"
              [attr.aria-label]="endLabel"
              [pTooltip]="endLabel"
              tooltipPosition="top"
              (click)="endRoom.emit()"
            ></button>
          }
          <span class="divider" aria-hidden="true"></span>
          @let leaveLabel = 'Leave quietly';
          <button
            pButton
            type="button"
            class="leave leave-compact"
            size="large"
            icon="pi pi-sign-out"
            severity="danger"
            [outlined]="false"
            [rounded]="true"
            [label]="leaveLabel"
            [attr.aria-label]="leaveLabel"
            (click)="leave.emit()"
          ></button>
        </div>
        <p-popover #picker appendTo="body" ariaLabel="Send a reaction">
          <app-reaction-picker (chosen)="react.emit($event)" />
        </p-popover>
      </ng-template>
    </p-toolbar>
  `,
  styleUrl: './room-controls.component.scss',
})
export class RoomControlsComponent {
  readonly onStage = input(false);
  readonly handRaised = input(false);
  readonly busy = input(false);
  readonly audio = input<AudioStatus>('idle');
  readonly canSpeak = input(false);
  /** A speaker who is not the host may step down to the audience; the host keeps the stage. */
  readonly canStepDown = input(false);
  readonly micOn = input(false);
  readonly soundBlocked = input(false);
  readonly micRefused = input(false);
  readonly unread = input(0);
  readonly chatShown = input(true);
  /** The host's own tools: on a phone, where the header has no room for them, they sit in the dock. */
  readonly isHost = input(false);

  readonly leave = output<void>();
  readonly editRoom = output<void>();
  readonly endRoom = output<void>();
  readonly stepDown = output<void>();
  readonly raiseHand = output<void>();
  readonly lowerHand = output<void>();
  readonly toggleMic = output<void>();
  readonly enableSound = output<void>();
  readonly retryAudio = output<void>();
  readonly react = output<Reaction>();
  readonly chat = output<void>();

  /** The microphone is offered only to someone who may speak, and only while there is audio to speak into. */
  protected readonly micShown = computed(() => this.canSpeak() && this.audio() === 'connected');
  protected readonly chatLabel = computed(() =>
    this.unread() > 0 ? `Chat, ${this.unread()} unread` : 'Chat',
  );
  protected readonly labelId = `app-room-controls-${nextId++}`;
}
