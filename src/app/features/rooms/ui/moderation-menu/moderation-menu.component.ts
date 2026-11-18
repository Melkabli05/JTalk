import { Component, input } from '@angular/core';
import type { MenuItem } from '@openng/optimus-ui/api';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Menu } from '@openng/optimus-ui/menu';
import { Tooltip } from '@openng/optimus-ui/tooltip';
import { TranslatePipe } from '@shared/pipes/translate.pipe';

/**
 * What a host can do to one person, one tap away from their seat: a quiet `⋯` button that shows when the pointer or the keyboard is
 * on the seat (always on a touch screen, which has no hover), and opens a menu. The seat's owner places it and lights it.
 */
@Component({
  selector: 'app-moderation-menu',
  imports: [ButtonDirective, Menu, Tooltip, TranslatePipe],
  template: `
    @let label = '{name}: moderation' | t: { name: name() };
    <button
      pButton
      type="button"
      class="compact"
      icon="pi pi-ellipsis-h"
      severity="secondary"
      [rounded]="true"
      [attr.aria-label]="label"
      [pTooltip]="label"
      tooltipPosition="top"
      (click)="menu.toggle($event)"
    ></button>
    <p-menu #menu appendTo="body" [popup]="true" [model]="[...items()]" />
  `,
  styleUrl: './moderation-menu.component.scss',
})
export class ModerationMenuComponent {
  readonly name = input.required<string>();
  readonly items = input.required<readonly MenuItem[]>();
}
