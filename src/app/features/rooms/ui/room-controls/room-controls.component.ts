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
          <i class="pi pi-hand" aria-hidden="true"></i>
          {{ 'Waiting for the host to let you speak. Tap the hand again to cancel.' | t }}
        </p>
      }
    </div>
    <p-toolbar [ariaLabelledBy]="labelId" [attr.aria-busy]="busy()">
      <ng-template #start>
        <div class="group">
          @let leaveLabel = 'Leave quietly' | t;
          <button
            pButton
            type="button"
            class="leave-compact"
            size="large"
            icon="pi pi-sign-out"
            severity="secondary"
            [rounded]="true"
            [outlined]="true"
            [label]="leaveLabel"
            [attr.aria-label]="leaveLabel"
            (click)="leave.emit()"
          ></button>
          @if (canSpeak()) {
            <button
              pButton
              type="button"
              [icon]="micOn() ? 'pi pi-microphone' : 'pi pi-microphone pi-slashed'"
              [label]="micOn() ? ('Mute' | t) : ('Unmute' | t)"
              [severity]="micOn() ? 'primary' : 'secondary'"
              [rounded]="true"
              (click)="toggleMic.emit()"
            ></button>
          }
          @if (!onStage()) {
            <button
              pButton
              type="button"
              icon="pi pi-hand"
              [label]="'Raise hand' | t"
              [severity]="handRaised() ? 'primary' : 'secondary'"
              [rounded]="true"
              [outlined]="!handRaised()"
              [disabled]="busy()"
              [attr.aria-pressed]="handRaised()"
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
            size="large"
            icon="pi pi-ellipsis-h"
            severity="secondary"
            [rounded]="true"
            [text]="true"
            [attr.aria-label]="moreLabel"
            [pTooltip]="moreLabel"
            tooltipPosition="top"
            (click)="menu.toggle($event)"
          ></button>
          <p-menu
            #menu
            appendTo="body"
            [popup]="true"
            [ariaLabel]="moreLabel"
            [model]="[...actions()]"
          />
        }
      </ng-template>
    </p-toolbar>
  `,
  styleUrl: './room-controls.component.scss',
})
export class RoomControlsComponent {
  readonly actions = input<readonly MenuItem[]>([]);
  readonly onStage = input(false);
  readonly handRaised = input(false);
  readonly busy = input(false);
  readonly audio = input<AudioStatus>('idle');
  readonly canSpeak = input(false);
  readonly micOn = input(false);
  readonly soundBlocked = input(false);
  readonly micRefused = input(false);

  readonly leave = output<void>();
  readonly raiseHand = output<void>();
  readonly lowerHand = output<void>();
  readonly toggleMic = output<void>();
  readonly enableSound = output<void>();
  readonly retryAudio = output<void>();

  protected readonly labelId = `app-room-controls-${nextId++}`;
}
