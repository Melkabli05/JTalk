import { Component, input, output } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import type { AudioStatus } from '../../models/realtime.model';

/**
 * The dock, by role: a listener can leave or ask to speak (and take the request back), a speaker has the microphone beside
 * leave, the host also gets the room's own controls. It says who the person is in the room and how the audio is doing, and
 * sticks to the bottom of the screen.
 */
@Component({
  selector: 'app-room-controls',
  imports: [ButtonDirective, TranslatePipe],
  template: `
    <div class="bar">
      <div
        class="group primary"
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
          [rounded]="true"
          [outlined]="true"
          [label]="'Leave quietly' | t"
          (click)="leave.emit()"
        ></button>
        @if (canSpeak()) {
          <button
            pButton
            type="button"
            size="large"
            [icon]="micOn() ? 'pi pi-microphone' : 'pi pi-microphone pi-slashed'"
            [severity]="micOn() ? 'primary' : 'secondary'"
            [rounded]="true"
            [label]="micOn() ? ('Mute' | t) : ('Unmute' | t)"
            (click)="toggleMic.emit()"
          ></button>
        }
      </div>
      <div class="group secondary">
        @if (soundBlocked()) {
          <button
            pButton
            type="button"
            size="large"
            [rounded]="true"
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
            [rounded]="true"
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
              [rounded]="true"
              [label]="'Cancel request' | t"
              [disabled]="busy()"
              (click)="lowerHand.emit()"
            ></button>
          } @else {
            <button
              pButton
              type="button"
              size="large"
              icon="pi pi-megaphone"
              [rounded]="true"
              [outlined]="true"
              [label]="'Raise hand' | t"
              [disabled]="busy()"
              (click)="raiseHand.emit()"
            ></button>
          }
        }
      </div>
      <div class="status">
        @if (audio() === 'connected') {
          <p class="who">{{ onStage() ? ("You're on stage" | t) : ("You're listening" | t) }}</p>
        }
        <p class="audio" role="status">
          @switch (audio()) {
            @case ('connecting') {
              <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
              {{ 'Connecting audio…' | t }}
            }
            @case ('reconnecting') {
              <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
              {{ 'Reconnecting… trying to restore your connection.' | t }}
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
        @if (micRefused()) {
          <p class="hint warning" role="status">
            <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
            {{
              'We could not use your microphone. Allow it in your browser, then press Unmute.' | t
            }}
          </p>
        } @else if (handRaised() && !onStage()) {
          <p class="hint" role="status">{{ 'Waiting for the host to let you speak.' | t }}</p>
        }
      </div>
      @if (isHost()) {
        <div class="group host" role="group" [attr.aria-label]="'Host controls' | t">
          <button
            pButton
            type="button"
            size="large"
            icon="pi pi-pencil"
            severity="secondary"
            [rounded]="true"
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
            [rounded]="true"
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
  /** The browser or the person refused the microphone. */
  readonly micRefused = input(false);

  readonly leave = output<void>();
  readonly raiseHand = output<void>();
  readonly lowerHand = output<void>();
  readonly edit = output<void>();
  readonly end = output<void>();
  readonly toggleMic = output<void>();
  readonly enableSound = output<void>();
  readonly retryAudio = output<void>();
}
