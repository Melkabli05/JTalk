import { Component, input, output } from '@angular/core';
import type { MenuItem } from '@openng/optimus-ui/api';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Menu } from '@openng/optimus-ui/menu';
import { Message } from '@openng/optimus-ui/message';
import { Popover } from '@openng/optimus-ui/popover';
import { Toolbar } from '@openng/optimus-ui/toolbar';
import { Tooltip } from '@openng/optimus-ui/tooltip';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { REACTIONS, type Reaction } from '../../models/reaction.model';
import type { AudioStatus } from '../../models/realtime.model';
import { REACTION_LOOKS } from '../../utils/reactions';

let nextId = 0;

@Component({
  selector: 'app-room-controls',
  imports: [ButtonDirective, Menu, Message, Popover, Toolbar, Tooltip, TranslatePipe],
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
        <p-message severity="error" size="small" icon="pi pi-exclamation-triangle">
          <span class="message">
            {{ 'Audio is not available.' | t }}
            <button
              pButton
              type="button"
              size="small"
              icon="pi pi-refresh"
              severity="danger"
              [text]="true"
              [label]="'Reconnect audio' | t"
              (click)="retryAudio.emit()"
            ></button>
          </span>
        </p-message>
      }
      @if (micRefused()) {
        <p-message severity="warn" size="small" icon="pi pi-exclamation-triangle">{{
          'We could not use your microphone. Allow it in your browser, then press Unmute.' | t
        }}</p-message>
      }
      @if (soundBlocked()) {
        <p-message severity="info" size="small" icon="pi pi-volume-off">
          <span class="message">
            {{ 'Sound is off in this browser.' | t }}
            <button
              pButton
              type="button"
              size="small"
              icon="pi pi-volume-up"
              [text]="true"
              [label]="'Turn on sound' | t"
              (click)="enableSound.emit()"
            ></button>
          </span>
        </p-message>
      }
      @if (handRaised() && !onStage() && !micRefused()) {
        <p class="hint" role="status">
          <i class="pi pi-hand" aria-hidden="true"></i>
          {{ 'Waiting for the host to let you speak. Tap the hand again to cancel.' | t }}
        </p>
      }
    </div>
    <p-toolbar [ariaLabelledBy]="labelId" [attr.aria-busy]="busy()">
      <ng-template #start>
        @if (canSpeak()) {
          <button
            pButton
            type="button"
            class="main"
            size="large"
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
            class="main"
            size="large"
            icon="pi pi-hand"
            [label]="'Raise hand' | t"
            [severity]="handRaised() ? 'primary' : 'secondary'"
            [rounded]="true"
            [disabled]="busy()"
            [attr.aria-pressed]="handRaised()"
            (click)="handRaised() ? lowerHand.emit() : raiseHand.emit()"
          ></button>
        }
        @let reactLabel = 'React' | t;
        <button
          pButton
          type="button"
          size="large"
          icon="pi pi-face-smile"
          severity="secondary"
          [rounded]="true"
          [text]="true"
          [attr.aria-label]="reactLabel"
          [pTooltip]="reactLabel"
          tooltipPosition="top"
          (click)="picker.toggle($event)"
        ></button>
        <p-popover #picker appendTo="body" [ariaLabel]="'Send a reaction' | t">
          <div class="reactions">
            @for (item of looks; track item.reaction) {
              @let label = item.label | t;
              <button
                pButton
                type="button"
                size="large"
                [text]="true"
                [rounded]="true"
                [icon]="item.icon"
                [attr.aria-label]="label"
                [pTooltip]="label"
                tooltipPosition="top"
                (click)="react.emit(item.reaction)"
              ></button>
            }
          </div>
        </p-popover>
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

      <ng-template #end>
        @let leaveLabel = 'Leave quietly' | t;
        <button
          pButton
          type="button"
          class="leave leave-compact"
          size="large"
          icon="pi pi-sign-out"
          severity="secondary"
          [rounded]="true"
          [label]="leaveLabel"
          [attr.aria-label]="leaveLabel"
          (click)="leave.emit()"
        ></button>
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
  readonly react = output<Reaction>();

  protected readonly looks = REACTIONS.map((reaction) => ({
    reaction,
    ...REACTION_LOOKS[reaction],
  }));
  protected readonly labelId = `app-room-controls-${nextId++}`;
}
