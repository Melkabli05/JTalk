import { Component, input, output } from '@angular/core';
import { Dialog } from '@openng/optimus-ui/dialog';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import type { ProfileDraft } from '../../identity.models';
import { ProfileFormComponent } from '../profile-form/profile-form.component';

/** Asks a newcomer for a name and a picture before the app can be used; it cannot be dismissed. Editing happens on the profile page. */
@Component({
  selector: 'app-profile-dialog',
  imports: [Dialog, ProfileFormComponent, TranslatePipe],
  template: `
    <p-dialog
      [modal]="true"
      [closable]="false"
      [closeOnEscape]="false"
      [dismissableMask]="false"
      [style]="{ width: '34rem', maxWidth: '95vw', maxHeight: '96vh' }"
      [header]="'Create your profile' | t"
      [visible]="visible()"
    >
      @if (visible()) {
        <p class="intro">
          {{ 'Pick a name and a face. People in the rooms will see them.' | t }}
        </p>
        <app-profile-form (saved)="saved.emit($event)" />
      }
    </p-dialog>
  `,
  styles: `
    .intro {
      margin: 0 0 1.25rem;
      color: var(--p-text-muted-color);
    }
  `,
})
export class ProfileDialogComponent {
  readonly visible = input(false);

  readonly saved = output<ProfileDraft>();
}
