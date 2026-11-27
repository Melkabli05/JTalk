import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-profile-save-bar',
  imports: [MatButtonModule, MatProgressSpinnerModule],
  template: `
    @if (visible()) {
      <div class="save-bar-shell" id="profileSaveBar" role="region" aria-label="Unsaved changes">
        <span class="save-bar-status" aria-live="polite">
          {{ saving() ? 'Saving changes…' : statusLabel() }}
        </span>
        <div class="save-bar-actions">
          @if (showDiscard()) {
            <button
              matButton="text"
              type="button"
              id="profileDiscard"
              [disabled]="saving()"
              (click)="discard.emit()"
            >
              Discard
            </button>
          }
          <button
            matButton="tonal"
            type="button"
            id="profileSave"
            [disabled]="!canSave() || saving()"
            (click)="save.emit()"
          >
            @if (saving()) {
              <mat-progress-spinner
                class="save-spinner"
                mode="indeterminate"
                diameter="16"
                strokeWidth="2"
                aria-hidden="true"
              />
              <span>Saving…</span>
            } @else {
              <span>{{ saveLabel() }}</span>
            }
          </button>
        </div>
      </div>
    }
  `,
  styleUrl: './profile-save-bar.scss',
})
export class ProfileSaveBar {
  readonly visible = input(false);
  readonly saving = input(false);
  readonly canSave = input(false);
  readonly showDiscard = input(true);
  readonly statusLabel = input('Unsaved changes');
  readonly saveLabel = input('Save');

  readonly save = output<void>();
  readonly discard = output<void>();
}
