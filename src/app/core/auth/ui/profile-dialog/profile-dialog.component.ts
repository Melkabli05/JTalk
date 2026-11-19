import { Component, input, output } from '@angular/core';
import { Dialog } from '@openng/optimus-ui/dialog';
import { Message } from '@openng/optimus-ui/message';
import type { ProfileDraft } from '../../identity.models';
import { ProfileFormComponent } from '../profile-form/profile-form.component';

/** Asks a newcomer for a name and a picture before the app can be used; it cannot be dismissed. Editing happens on the profile page. */
@Component({
  selector: 'app-profile-dialog',
  imports: [Dialog, Message, ProfileFormComponent],
  template: `
    <p-dialog
      [modal]="true"
      [closable]="false"
      [closeOnEscape]="false"
      [dismissableMask]="false"
      [style]="{ width: '34rem', maxWidth: '95vw', maxHeight: '96vh' }"
      header="Create your profile"
      [visible]="visible()"
    >
      @if (visible()) {
        <p class="intro">Pick a name and a face. People in the rooms will see them.</p>
        @if (error(); as text) {
          <p-message class="error" severity="error" variant="simple" role="alert">{{
            text
          }}</p-message>
        }
        <app-profile-form [busy]="busy()" (saved)="saved.emit($event)" />
      }
    </p-dialog>
  `,
  styles: `
    .error {
      display: block;
      margin-block-end: 1rem;
    }

    .intro {
      margin: 0 0 1.25rem;
      color: var(--p-text-muted-color);
    }
  `,
})
export class ProfileDialogComponent {
  readonly visible = input(false);
  readonly busy = input(false);
  /** Why the last save failed, to be shown above the form. */
  readonly error = input<string | null>(null);

  readonly saved = output<ProfileDraft>();
}
