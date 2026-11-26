import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { LanguageFilterChip, RoomLangFilter } from '../../constants/rooms.constants';

@Component({
  selector: 'app-language-chips',
  imports: [MatChipsModule],
  templateUrl: './language-chips.html',
  styleUrl: './language-chips.scss',
})
export class LanguageChips {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly chipsRowRef = viewChild<ElementRef<HTMLDivElement>>('chipsRow');

  readonly chips = input.required<readonly LanguageFilterChip[]>();
  readonly selected = input.required<RoomLangFilter>();
  readonly filterChange = output<RoomLangFilter>();

  readonly canScrollRight = signal(false);
  readonly isDragging = signal(false);

  private dragState: { x: number; scrollLeft: number } | null = null;
  private chipDragged = false;

  constructor() {
    afterNextRender(() => {
      const row = this.chipsRowRef()?.nativeElement;
      if (!row) return;

      const view = this.document.defaultView;
      const syncFade = () => {
        if (!this.destroyRef.destroyed) this.updateScrollFade();
      };

      view?.addEventListener('resize', syncFade);
      const resizeObserver =
        typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncFade) : null;
      resizeObserver?.observe(row);

      if (this.document.fonts) {
        void this.document.fonts.ready.then(syncFade);
      }

      const rafId = view?.requestAnimationFrame(syncFade) ?? 0;
      this.updateScrollFade();

      this.destroyRef.onDestroy(() => {
        view?.removeEventListener('resize', syncFade);
        if (rafId) view?.cancelAnimationFrame(rafId);
        resizeObserver?.disconnect();
      });
    });
  }

  updateScrollFade(): void {
    const row = this.chipsRowRef()?.nativeElement;
    if (!row) return;
    const max = row.scrollWidth - row.clientWidth;
    this.canScrollRight.set(max > 1 && row.scrollLeft < max - 1);
  }

  onWheel(event: WheelEvent): void {
    const row = this.chipsRowRef()?.nativeElement;
    if (!row || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    const max = row.scrollWidth - row.clientWidth;
    if (max <= 1) return;
    const next = Math.max(0, Math.min(max, row.scrollLeft + event.deltaY));
    if (next !== row.scrollLeft) {
      event.preventDefault();
      row.scrollLeft = next;
    }
  }

  onPointerDown(event: PointerEvent): void {
    const row = this.chipsRowRef()?.nativeElement;
    if (!row || event.pointerType === 'touch' || event.button !== 0) return;
    this.dragState = { x: event.clientX, scrollLeft: row.scrollLeft };
    this.chipDragged = false;
  }

  onPointerMove(event: PointerEvent): void {
    const row = this.chipsRowRef()?.nativeElement;
    if (!row || !this.dragState) return;
    const dx = event.clientX - this.dragState.x;
    if (Math.abs(dx) > 4) {
      this.chipDragged = true;
      this.isDragging.set(true);
    }
    if (this.chipDragged) {
      row.scrollLeft = this.dragState.scrollLeft - dx;
    }
  }

  onPointerEnd(): void {
    this.dragState = null;
    this.isDragging.set(false);
  }

  onChipClick(event: MouseEvent): void {
    if (this.chipDragged) {
      event.preventDefault();
      event.stopPropagation();
      this.chipDragged = false;
    }
  }

  onSelectionChange(event: MatChipListboxChange): void {
    const selected = this.chips().find(chip => chip.value === event.value);
    this.filterChange.emit(selected?.value ?? 'all');
  }
}
