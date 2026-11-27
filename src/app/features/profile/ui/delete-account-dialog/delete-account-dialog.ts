import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-delete-account-dialog',
  imports: [FormField, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './delete-account-dialog.html',
  styleUrl: './delete-account-dialog.scss',
})
export class DeleteAccountDialog {
  private readonly dialogRef = inject(MatDialogRef<DeleteAccountDialog, boolean>);

  readonly confirmModel = signal('');
  readonly confirmField = form(this.confirmModel);

  readonly canDelete = computed(() => this.confirmModel() === 'DELETE');

  onConfirm(): void {
    if (!this.canDelete()) return;
    this.dialogRef.close(true);
  }
}
