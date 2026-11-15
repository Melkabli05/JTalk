import { Component, input, output } from '@angular/core';
import type { MenuItem } from '@openng/optimus-ui/api';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Menu } from '@openng/optimus-ui/menu';
import { Message } from '@openng/optimus-ui/message';
import { Toolbar } from '@openng/optimus-ui/toolbar';
import { Tooltip } from '@openng/optimus-ui/tooltip';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import type { AudioStatus } from '../../models/realtime.model';

let nextId = 0;

/**
 * The dock, by role. Leave is a pill on one side; what the person does in the conversation (the microphone for a speaker, the
 * hand for a listener) is a round icon button in the middle, the way every audio room does it; the host's actions sit behind a
 * menu the page gives it. It says nothing while all is well, and speaks (a `p-message`) only when the audio is lost, coming back, or the
 * microphone is refused. An Optimus `p-toolbar`; it sticks to the bottom of the screen.
 */
@Component({
  selector: 'app-room-controls',
  imports: [ButtonDirective, Menu, Message, Toolbar, Tooltip, TranslatePipe],
  template: `
    <span class="cdk-visually-hidden" [id]="labelId">{{ 'Room controls' | t }}</span>
    <div class="notes">
      @if (audio() === 'connecting') {
        <p class="connecting" role="status">
          <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
          {{ 'Connecting audio…' | t }}
        </p>
      }
      @if (audio() === 'reconnecting') {
        <p-message severity="warn" size="small" icon="pi pi-spin pi-spinner">{{
          'Reconnecting… trying to restore your connection.' | t
        }}</p-message>
      }
      @if (audio() === 'failed') {
        <p-message severity="error" size="small" icon="pi pi-exclamation-triangle">{{
          'Audio is not available.' | t
        }}</p-message>
      }
      @if (micRefused()) {
        <p-message severity="warn" size="small" icon="pi pi-exclamation-triangle">{{
          'We could not use your microphone. Allow it in your browser, then press Unmute.' | t
        }}</p-message>
      } @else if (handRaised() && !onStage()) {
        <p class="hint" role="status">
          {{ 'Waiting for the host to let you speak. Tap the hand again to cancel.' | t }}
        </p>
      }
    </div>
    <p-toolbar [ariaLabelledBy]="labelId" [attr.aria-busy]="busy()">
      <ng-template #start>
        <button
          pButton
          type="button"
          size="large"
          icon="pi pi-sign-out"
          severity="secondary"
          [rounded]="true"
          [outlined]="true"
          [label]="'Leave quietly' | t"
          (click)="leave.emit()"
        ></button>
      </ng-template>

      <ng-template #center>
        <div class="group">
          @if (canSpeak()) {
            @let micLabel = micOn() ? ('Mute' | t) : ('Unmute' | t);
            <button
              pButton
              type="button"
              class="round"
              [icon]="micOn() ? 'pi pi-microphone' : 'pi pi-microphone pi-slashed'"
              [severity]="micOn() ? 'primary' : 'secondary'"
              [rounded]="true"
              [attr.aria-label]="micLabel"
              [pTooltip]="micLabel"
              (click)="toggleMic.emit()"
            ></button>
          }
          @if (!onStage()) {
            @let handLabel = 'Raise hand' | t;
            <button
              pButton
              type="button"
              class="round"
              icon="pi pi-megaphone"
              [severity]="handRaised() ? 'primary' : 'secondary'"
              [rounded]="true"
              [outlined]="!handRaised()"
              [disabled]="busy()"
              [attr.aria-label]="handLabel"
              [attr.aria-pressed]="handRaised()"
              [pTooltip]="handLabel"
              (click)="handRaised() ? lowerHand.emit() : raiseHand.emit()"
            ></button>
          }
          @if (soundBlocked()) {
            <button
              pButton
              type="button"
              size="large"
              icon="pi pi-volume-up"
              [rounded]="true"
              [label]="'Turn on sound' | t"
              (click)="enableSound.emit()"
            ></button>
          }
          @if (audio() === 'failed') {
            <button
              pButton
              type="button"
              size="large"
              icon="pi pi-refresh"
              severity="secondary"
              [rounded]="true"
              [label]="'Reconnect audio' | t"
              (click)="retryAudio.emit()"
            ></button>
          }
        </div>
      </ng-template>

      <ng-template #end>
        @if (actions().length > 0) {
          @let moreLabel = 'More actions' | t;
          <button
            pButton
            type="button"
            class="round"
            icon="pi pi-ellipsis-h"
            severity="secondary"
            aria-haspopup="menu"
            [rounded]="true"
            [text]="true"
            [attr.aria-label]="moreLabel"
            [pTooltip]="moreLabel"
            (click)="menu.toggle($event)"
          ></button>
          <p-menu #menu [popup]="true" appendTo="body" [model]="[...actions()]" />
        }
      </ng-template>
    </p-toolbar>
  `,
  styleUrl: './room-controls.component.scss',
})
export class RoomControlsComponent {
  /** What only the host can do for the room, already worded for the person: a menu behind a button, empty for everyone else. */
  readonly actions = input<readonly MenuItem[]>([]);
  readonly onStage = input(false);
  readonly handRaised = input(false);
  readonly busy = input(false);
  readonly audio = input<AudioStatus>('idle');
  /** The server lets this person speak (they are on stage). */
  readonly canSpeak = input(false);
  readonly micOn = input(false);
  /** The browser will not play sound until the person taps. */
  readonly soundBlocked = input(false);
  /** The browser or the person refused the microphone. */
  readonly micRefused = input(false);

  readonly leave = output<void>();
  readonly raiseHand = output<void>();
  readonly lowerHand = output<void>();
  readonly toggleMic = output<void>();
  readonly enableSound = output<void>();
  readonly retryAudio = output<void>();

  protected readonly labelId = `app-room-controls-${nextId++}`;
}
