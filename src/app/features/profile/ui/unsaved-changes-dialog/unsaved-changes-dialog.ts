import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-unsaved-changes-dialog',
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Leave without saving?</h2>
    <mat-dialog-content>
      <p>Your profile edits have not been saved yet. If you leave now, those changes will be lost.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="text" type="button" (click)="close(false)" cdkFocusInitial>
        Stay
      </button>
      <button matButton="tonal" type="button" (click)="close(true)">
        Leave without saving
      </button>
    </mat-dialog-actions>
  `,
})
export class UnsavedChangesDialog {
  private readonly dialogRef = inject(MatDialogRef<UnsavedChangesDialog, boolean>);

  close(leave: boolean): void {
    this.dialogRef.close(leave);
  }
}
