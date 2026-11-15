import { Component, input, output } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { TranslatePipe } from '@shared/pipes/translate.pipe';

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

  readonly leave = output<void>();
  readonly raiseHand = output<void>();
  readonly lowerHand = output<void>();
  readonly edit = output<void>();
  readonly end = output<void>();
}
