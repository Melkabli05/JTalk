import { Component, input, output } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { TranslatePipe } from '@shared/pipes/translate.pipe';

@Component({
  selector: 'app-follow-button',
  imports: [ButtonDirective, TranslatePipe],
  template: `
    @if (following()) {
      <button
        pButton
        type="button"
        icon="pi pi-check"
        severity="secondary"
        [rounded]="true"
        [outlined]="true"
        [disabled]="busy()"
        [label]="'Following' | t"
        (click)="unfollow.emit()"
      ></button>
    } @else {
      <button
        pButton
        type="button"
        icon="pi pi-user-plus"
        [rounded]="true"
        [disabled]="busy()"
        [label]="followsMe() ? ('Follow back' | t) : ('Follow' | t)"
        (click)="follow.emit()"
      ></button>
    }
  `,
})
export class FollowButtonComponent {
  readonly following = input(false);
  readonly followsMe = input(false);
  readonly busy = input(false);

  readonly follow = output<void>();
  readonly unfollow = output<void>();
}
