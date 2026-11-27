import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import type { ConfirmActionDialogData } from '../../models/live-room.model';

@Component({
  selector: 'app-confirm-action-dialog',
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="text" type="button" [mat-dialog-close]="false">Cancel</button>
      <button
        matButton="filled"
        [class.btn-danger-filled]="data.danger"
        type="button"
        id="confirmActionBtn"
        [mat-dialog-close]="true"
      >
        {{ data.confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmActionDialog {
  readonly data = inject<ConfirmActionDialogData>(MAT_DIALOG_DATA);
}
