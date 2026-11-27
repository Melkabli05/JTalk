import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface SuccessorCandidate {
  readonly id: string;
  readonly name: string;
  readonly initial: string;
  readonly avatarUrl: string | null;
  readonly chipClass: string;
  readonly roleLabel: string;
}

export interface ChooseSuccessorDialogData {
  readonly candidates: readonly SuccessorCandidate[];
}

export type ChooseSuccessorDialogResult =
  | { readonly action: 'assign'; readonly successorUserId: string }
  | { readonly action: 'end-room' };

@Component({
  selector: 'app-choose-successor-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Choose the next host</h2>
    <mat-dialog-content class="successor-body">
      <p class="successor-copy">
        Select someone to take over as host before you leave, or end the room for everyone.
      </p>
      <div class="successor-list" role="radiogroup" aria-label="Choose next host">
        @for (candidate of candidates; track candidate.id) {
          <button
            type="button"
            class="successor-option"
            [class.selected]="selectedId() === candidate.id"
            role="radio"
            [attr.aria-checked]="selectedId() === candidate.id"
            (click)="selectedId.set(candidate.id)"
          >
            @if (candidate.avatarUrl) {
              <img class="successor-avatar" [src]="candidate.avatarUrl" [alt]="candidate.name" />
            } @else {
              <span class="successor-avatar-fallback" [class]="candidate.chipClass">
                {{ candidate.initial }}
              </span>
            }
            <span class="successor-meta">
              <span class="successor-name">{{ candidate.name }}</span>
              <span class="successor-role">{{ candidate.roleLabel }}</span>
            </span>
            @if (selectedId() === candidate.id) {
              <mat-icon class="successor-check">check_circle</mat-icon>
            }
          </button>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end" class="successor-actions">
      <button mat-button type="button" color="warn" (click)="endRoom()">
        End Room for Everyone
      </button>
      <button mat-button type="button" mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        type="button"
        color="primary"
        [disabled]="!selectedId()"
        (click)="assignHost()"
      >
        Assign Host &amp; Leave
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .successor-body {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-top: 4px;
    }
    .successor-copy {
      margin: 0;
      font-size: 0.9rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .successor-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 280px;
      overflow-y: auto;
    }
    .successor-option {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 8px 12px;
      border-radius: 12px;
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
      cursor: pointer;
      text-align: left;
      transition: background-color 140ms ease, border-color 140ms ease;
    }
    .successor-option:hover {
      background: var(--mat-sys-surface-container-low);
    }
    .successor-option.selected {
      border-color: var(--mat-sys-primary);
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .successor-avatar,
    .successor-avatar-fallback {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      display: grid;
      place-items: center;
      font-weight: 600;
      font-size: 0.85rem;
    }
    .successor-meta {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }
    .successor-name {
      font-weight: 600;
      font-size: 0.92rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .successor-role {
      font-size: 0.78rem;
      opacity: 0.75;
    }
    .successor-check {
      color: var(--mat-sys-primary);
      flex-shrink: 0;
    }
    .successor-actions {
      flex-wrap: wrap;
      gap: 8px;
    }
  `,
})
export class ChooseSuccessorDialog {
  private readonly dialogRef = inject(
    MatDialogRef<ChooseSuccessorDialog, ChooseSuccessorDialogResult>,
  );
  private readonly data = inject<ChooseSuccessorDialogData>(MAT_DIALOG_DATA);
  readonly candidates = this.data.candidates;
  readonly selectedId = signal<string | null>(this.candidates[0]?.id ?? null);

  assignHost(): void {
    const id = this.selectedId();
    if (id) {
      this.dialogRef.close({ action: 'assign', successorUserId: id });
    }
  }

  endRoom(): void {
    this.dialogRef.close({ action: 'end-room' });
  }
}
