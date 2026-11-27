import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export interface EndRoomDialogData {
  readonly roomTitle?: string;
}

@Component({
  selector: 'app-end-room-dialog',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './end-room-dialog.html',
  styleUrl: './end-room-dialog.scss',
})
export class EndRoomDialog {
  private readonly data = inject<EndRoomDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  readonly roomTitle = this.data?.roomTitle?.trim() || null;
}
