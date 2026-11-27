import {
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import {
  PROFILE_AVATAR_EXPORT_PX,
  PROFILE_AVATAR_MAX_DECODE_PX,
  PROFILE_AVATAR_MIN_PX,
  PROFILE_AVATAR_TARGET_MAX_BYTES,
} from '../../constants/profile.constants';

export interface AvatarCropDialogData {
  readonly file: File;
}

export interface AvatarCropDialogResult {
  readonly blob: Blob;
  readonly previewUrl: string;
}

const PREVIEW_CANVAS_PX = 256;
const JPEG_QUALITIES: readonly number[] = [0.9, 0.82, 0.72, 0.6];

@Component({
  selector: 'app-avatar-crop-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatSliderModule],
  templateUrl: './avatar-crop-dialog.html',
  styleUrl: './avatar-crop-dialog.scss',
})
export class AvatarCropDialog {
  private readonly dialogRef = inject(
    MatDialogRef<AvatarCropDialog, AvatarCropDialogResult | undefined>,
  );
  private readonly data = inject<AvatarCropDialogData>(MAT_DIALOG_DATA);
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('cropCanvas');

  readonly zoom = signal(1);
  readonly loading = signal(true);
  readonly exporting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  private sourceImage: HTMLImageElement | null = null;
  private sourceUrl: string | null = null;
  private offsetX = 0;
  private offsetY = 0;
  private dragPointerId: number | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragOriginX = 0;
  private dragOriginY = 0;

  readonly canApply = computed(
    () => !this.loading() && !this.exporting() && this.errorMessage() === null,
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.sourceUrl) {
        URL.revokeObjectURL(this.sourceUrl);
        this.sourceUrl = null;
      }
    });
    this.loadImage(this.data.file);
  }

  onZoomChange(next: number): void {
    const clamped = Math.min(3, Math.max(1, Number.isFinite(next) ? next : 1));
    this.zoom.set(clamped);
    this.clampOffsets();
    this.redraw();
  }

  nudgeZoom(delta: number): void {
    this.onZoomChange(Number((this.zoom() + delta).toFixed(2)));
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.sourceImage) return;
    this.dragPointerId = event.pointerId;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragOriginX = this.offsetX;
    this.dragOriginY = this.offsetY;
    const target = event.currentTarget;
    if (target instanceof HTMLElement && typeof target.setPointerCapture === 'function') {
      target.setPointerCapture(event.pointerId);
    }
  }

  onPointerMove(event: PointerEvent): void {
    if (this.dragPointerId !== event.pointerId || !this.sourceImage) return;
    this.offsetX = this.dragOriginX + (event.clientX - this.dragStartX);
    this.offsetY = this.dragOriginY + (event.clientY - this.dragStartY);
    this.clampOffsets();
    this.redraw();
  }

  onPointerUp(event: PointerEvent): void {
    if (this.dragPointerId === event.pointerId) {
      this.dragPointerId = null;
    }
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  async applyCrop(): Promise<void> {
    if (!this.canApply() || !this.sourceImage) return;
    this.exporting.set(true);
    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = PROFILE_AVATAR_EXPORT_PX;
      exportCanvas.height = PROFILE_AVATAR_EXPORT_PX;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) {
        this.errorMessage.set('Could not prepare image preview.');
        return;
      }
      this.drawToContext(ctx, PROFILE_AVATAR_EXPORT_PX);

      let bestBlob: Blob | null = null;
      for (const quality of JPEG_QUALITIES) {
        const blob = await new Promise<Blob | null>((resolve) =>
          exportCanvas.toBlob(resolve, 'image/jpeg', quality),
        );
        if (!blob) continue;
        bestBlob = blob;
        if (blob.size <= PROFILE_AVATAR_TARGET_MAX_BYTES) break;
      }

      if (!bestBlob) {
        this.errorMessage.set('Could not export the cropped picture.');
        return;
      }

      const previewUrl = URL.createObjectURL(bestBlob);
      this.dialogRef.close({ blob: bestBlob, previewUrl });
    } finally {
      this.exporting.set(false);
    }
  }

  private loadImage(file: File): void {
    this.sourceUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (Math.min(width, height) < PROFILE_AVATAR_MIN_PX) {
        this.errorMessage.set(
          `The picture must be at least ${PROFILE_AVATAR_MIN_PX} pixels on each side.`,
        );
        this.loading.set(false);
        return;
      }
      if (Math.max(width, height) > PROFILE_AVATAR_MAX_DECODE_PX) {
        this.errorMessage.set(
          `The picture must be at most ${PROFILE_AVATAR_MAX_DECODE_PX} pixels on each side.`,
        );
        this.loading.set(false);
        return;
      }
      this.sourceImage = img;
      this.offsetX = 0;
      this.offsetY = 0;
      this.loading.set(false);
      queueMicrotask(() => this.redraw());
    };
    img.onerror = () => {
      this.errorMessage.set('That file could not be read as a JPEG or PNG picture.');
      this.loading.set(false);
    };
    img.src = this.sourceUrl;
  }

  private clampOffsets(): void {
    const img = this.sourceImage;
    if (!img) return;
    const baseScale = PREVIEW_CANVAS_PX / Math.min(img.naturalWidth, img.naturalHeight);
    const drawW = img.naturalWidth * baseScale * this.zoom();
    const drawH = img.naturalHeight * baseScale * this.zoom();
    const maxOffsetX = Math.max(0, (drawW - PREVIEW_CANVAS_PX) / 2);
    const maxOffsetY = Math.max(0, (drawH - PREVIEW_CANVAS_PX) / 2);
    this.offsetX = Math.min(maxOffsetX, Math.max(-maxOffsetX, this.offsetX));
    this.offsetY = Math.min(maxOffsetY, Math.max(-maxOffsetY, this.offsetY));
  }

  private redraw(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !this.sourceImage) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.drawToContext(ctx, PREVIEW_CANVAS_PX);
  }

  private drawToContext(ctx: CanvasRenderingContext2D, targetPx: number): void {
    const img = this.sourceImage;
    if (!img) return;
    const ratio = targetPx / PREVIEW_CANVAS_PX;
    const baseScale = targetPx / Math.min(img.naturalWidth, img.naturalHeight);
    const drawW = img.naturalWidth * baseScale * this.zoom();
    const drawH = img.naturalHeight * baseScale * this.zoom();
    const dx = (targetPx - drawW) / 2 + this.offsetX * ratio;
    const dy = (targetPx - drawH) / 2 + this.offsetY * ratio;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetPx, targetPx);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, dx, dy, drawW, drawH);
  }
}
