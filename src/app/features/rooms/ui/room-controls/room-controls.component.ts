import { Component, input, output } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import type { AudioStatus } from '../../models/realtime.model';

/** What the person in the room can do for themselves, and what only the host can do for the room. Sticks to the bottom of the screen. */
@Component({
  selector: 'app-room-controls',
  imports: [ButtonDirective, TranslatePipe],
  template: `
    <div class="bar">
      <div
        class="group"
        role="group"
        [attr.aria-label]="'Room controls' | t"
        [attr.aria-busy]="busy()"
      >
        <button
          pButton
          type="button"
          size="large"
          icon="pi pi-sign-out"
          severity="secondary"
          [outlined]="true"
          [label]="'Leave quietly' | t"
          (click)="leave.emit()"
        ></button>
        @if (canSpeak()) {
          <button
            pButton
            type="button"
            size="large"
            [icon]="micOn() ? 'pi pi-microphone' : 'pi pi-microphone-slash'"
            [severity]="micOn() ? 'primary' : 'danger'"
            [label]="micOn() ? ('Mute' | t) : ('Unmute' | t)"
            (click)="toggleMic.emit()"
          ></button>
        }
        @if (soundBlocked()) {
          <button
            pButton
            type="button"
            size="large"
            icon="pi pi-volume-up"
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
            [label]="'Reconnect audio' | t"
            (click)="retryAudio.emit()"
          ></button>
        }
        @if (!onStage()) {
          @if (handRaised()) {
            <button
              pButton
              type="button"
              size="large"
              icon="pi pi-megaphone"
              severity="secondary"
              [label]="'Lower hand' | t"
              [disabled]="busy()"
              (click)="lowerHand.emit()"
            ></button>
          } @else {
            <button
              pButton
              type="button"
              size="large"
              icon="pi pi-megaphone"
              [label]="'Raise hand' | t"
              [disabled]="busy()"
              (click)="raiseHand.emit()"
            ></button>
          }
        }
      </div>
      <p class="audio" role="status">
        @switch (audio()) {
          @case ('connecting') {
            <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
            {{ 'Connecting audio…' | t }}
          }
          @case ('connected') {
            <i class="pi pi-check-circle" aria-hidden="true"></i>
            {{ 'Audio connected' | t }}
          }
          @case ('failed') {
            <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
            {{ 'Audio is not available.' | t }}
          }
        }
      </p>
      @if (isHost()) {
        <div class="group host" role="group" [attr.aria-label]="'Host controls' | t">
          <button
            pButton
            type="button"
            size="large"
            icon="pi pi-pencil"
            severity="secondary"
            [text]="true"
            [label]="'Edit the room' | t"
            (click)="edit.emit()"
          ></button>
          <button
            pButton
            type="button"
            size="large"
            icon="pi pi-stop-circle"
            severity="danger"
            [outlined]="true"
            [label]="'End the room' | t"
            (click)="end.emit()"
          ></button>
        </div>
      }
    </div>
  `,
  styleUrl: './room-controls.component.scss',
})
export class RoomControlsComponent {
  readonly isHost = input(false);
  readonly onStage = input(false);
  readonly handRaised = input(false);
  readonly busy = input(false);
  readonly audio = input<AudioStatus>('idle');
  /** The server lets this person speak (they are on stage). */
  readonly canSpeak = input(false);
  readonly micOn = input(false);
  /** The browser will not play sound until the person taps. */
  readonly soundBlocked = input(false);

  readonly leave = output<void>();
  readonly raiseHand = output<void>();
  readonly lowerHand = output<void>();
  readonly edit = output<void>();
  readonly end = output<void>();
  readonly toggleMic = output<void>();
  readonly enableSound = output<void>();
  readonly retryAudio = output<void>();
}
