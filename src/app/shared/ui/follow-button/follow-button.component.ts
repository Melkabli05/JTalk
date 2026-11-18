import { Component, input, output } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { TranslatePipe } from '@shared/pipes/translate.pipe';

@Component({
  selector: 'app-follow-button',
  host: { '[class.block]': 'block()' },
  styles: ':host(.block) { display: block; } :host(.block) button { inline-size: 100%; }',
  imports: [ButtonDirective, TranslatePipe],
  template: `
    @if (following()) {
      <button
        pButton
        type="button"
        icon="pi pi-check"
        [class.compact]="compact()"
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
        [class.compact]="compact()"
        [rounded]="true"
        [disabled]="busy()"
        [label]="followsMe() ? ('Follow back' | t) : ('Follow' | t)"
        (click)="follow.emit()"
      ></button>
    }
  `,
})
export class FollowButtonComponent {
  /** Fills the width it is given, as the main action of a card. */
  readonly block = input(false);
  readonly following = input(false);
  readonly followsMe = input(false);
  readonly busy = input(false);
  readonly compact = input(false);

  readonly follow = output<void>();
  readonly unfollow = output<void>();
}
