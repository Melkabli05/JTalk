import { Component, type ElementRef, input, type OnDestroy, viewChild } from '@angular/core';
import type { MenuItem } from '@openng/optimus-ui/api';
import { Menu } from '@openng/optimus-ui/menu';

/** How long the pointer rests on a seat before the menu opens, so passing over seats does not flash menus. */
const HOVER_MS = 350;
/** How long the pointer may be away from the seat and the menu before the menu closes (the gap between them). */
const LEAVE_MS = 300;
/** A touch held this long is a long press. */
const PRESS_MS = 500;
/** A finger that moves farther than this is scrolling, not pressing. */
const PRESS_SLOP_PX = 10;

/**
 * What a host can do to one person, offered where the person is and with no button of its own: it wraps their seat, and opens a menu
 * under the seat when the pointer rests on it, when the seat is pressed and held on a touch screen, or on a right click or the
 * keyboard's menu key. Seats it has no items for behave as if it were not there. The seat is still an ordinary button: pressing it
 * opens the person, and that card has the same actions for anyone who cannot hover or hold.
 */
@Component({
  selector: 'app-moderation-menu',
  imports: [Menu],
  template: `
    <div
      #seat
      class="moderated"
      (pointerenter)="entered($event)"
      (pointerleave)="left($event)"
      (pointerdown)="pressed($event)"
      (pointermove)="moved($event)"
      (pointerup)="released()"
      (pointercancel)="released()"
      (touchend)="touchEnded($event)"
      (contextmenu)="contextRequested($event)"
    >
      <ng-content />
    </div>
    @if (items().length > 0) {
      <p-menu
        #menu
        appendTo="body"
        [popup]="true"
        [model]="[...items()]"
        [ariaLabel]="name() + ': moderation'"
        (onShow)="shown()"
        (onHide)="hidden()"
      />
    }
  `,
  styles: ':host, .moderated { display: contents; }',
})
export class ModerationMenuComponent implements OnDestroy {
  private readonly seat = viewChild.required<ElementRef<HTMLElement>>('seat');
  private readonly menu = viewChild<Menu>('menu');
  private hover: ReturnType<typeof setTimeout> | undefined;
  private leave: ReturnType<typeof setTimeout> | undefined;
  private press: ReturnType<typeof setTimeout> | undefined;
  private pressAt: { x: number; y: number } | undefined;
  private open = false;
  private overOverlay = false;
  private swallowClick = false;
  private overlay: HTMLElement | undefined;

  readonly name = input.required<string>();
  readonly items = input.required<readonly MenuItem[]>();

  ngOnDestroy(): void {
    clearTimeout(this.hover);
    clearTimeout(this.leave);
    clearTimeout(this.press);
    this.detachOverlay();
  }

  protected entered(event: PointerEvent): void {
    clearTimeout(this.leave);
    if (event.pointerType === 'mouse' && !this.open) {
      clearTimeout(this.hover);
      this.hover = setTimeout(() => this.show(), HOVER_MS);
    }
  }

  protected left(event: PointerEvent): void {
    clearTimeout(this.hover);
    if (event.pointerType === 'mouse' && this.open) {
      this.scheduleClose();
    }
  }

  protected pressed(event: PointerEvent): void {
    if (event.pointerType === 'mouse') {
      clearTimeout(this.hover);
      return;
    }
    this.released();
    this.swallowClick = false;
    this.pressAt = { x: event.clientX, y: event.clientY };
    this.press = setTimeout(() => {
      this.swallowClick = true;
      this.show();
    }, PRESS_MS);
  }

  protected moved(event: PointerEvent): void {
    if (
      this.pressAt !== undefined &&
      Math.hypot(event.clientX - this.pressAt.x, event.clientY - this.pressAt.y) > PRESS_SLOP_PX
    ) {
      this.released();
    }
  }

  protected released(): void {
    clearTimeout(this.press);
    this.pressAt = undefined;
  }

  /** The finger comes up after a long press: cancelling this stops the browser sending the click that would open the person. */
  protected touchEnded(event: Event): void {
    if (this.swallowClick) {
      this.swallowClick = false;
      event.preventDefault();
    }
  }

  protected contextRequested(event: MouseEvent): void {
    if (this.items().length > 0) {
      // A right click, the menu key, or a long press the browser reports itself (it would otherwise show its own menu).
      event.preventDefault();
      this.show();
    }
  }

  protected shown(): void {
    this.open = true;
    this.detachOverlay();
    const overlay = this.menu()?.container as HTMLElement | undefined;
    if (overlay !== undefined) {
      this.overlay = overlay;
      overlay.addEventListener('pointerenter', this.enterOverlay);
      overlay.addEventListener('pointerleave', this.leaveOverlay);
    }
  }

  protected hidden(): void {
    this.open = false;
    this.overOverlay = false;
    clearTimeout(this.leave);
    this.detachOverlay();
  }

  private readonly enterOverlay = () => {
    this.overOverlay = true;
    clearTimeout(this.leave);
  };

  private readonly leaveOverlay = () => {
    this.overOverlay = false;
    this.scheduleClose();
  };

  private show(): void {
    const anchor = this.seat().nativeElement.firstElementChild;
    if (this.items().length === 0 || anchor === null || this.open) {
      return;
    }
    this.menu()?.show({ currentTarget: anchor });
  }

  private scheduleClose(): void {
    clearTimeout(this.leave);
    this.leave = setTimeout(() => {
      if (!this.overOverlay) {
        this.menu()?.hide();
      }
    }, LEAVE_MS);
  }

  private detachOverlay(): void {
    this.overlay?.removeEventListener('pointerenter', this.enterOverlay);
    this.overlay?.removeEventListener('pointerleave', this.leaveOverlay);
    this.overlay = undefined;
  }
}
