import { Component, input, model, output } from '@angular/core';
import { Dialog } from '@openng/optimus-ui/dialog';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import type { Person, ProfileDraft } from '../../identity.models';
import { ProfileFormComponent } from '../profile-form/profile-form.component';

/**
 * The profile form in a modal dialog. Until the person has a profile it cannot be dismissed (`cancellable` is false):
 * the app is not usable without one. The form is created each time the dialog opens, so it always starts fresh.
 */
@Component({
  selector: 'app-profile-dialog',
  imports: [Dialog, ProfileFormComponent, TranslatePipe],
  template: `
    <p-dialog
      [modal]="true"
      [closable]="cancellable()"
      [closeOnEscape]="cancellable()"
      [dismissableMask]="false"
      [style]="{ width: '34rem', maxWidth: '95vw', maxHeight: '96vh' }"
      [header]="profile() ? ('Your profile' | t) : ('Create your profile' | t)"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
    >
      @if (visible()) {
        @if (!profile()) {
          <p class="intro">
            {{ 'Pick a name and a face. People in the rooms will see them.' | t }}
          </p>
        }
        <app-profile-form
          [profile]="profile()"
          [cancellable]="cancellable()"
          (saved)="saved.emit($event)"
          (cancelled)="visible.set(false)"
        />
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
  readonly visible = model(false);
  readonly profile = input<Person>();
  readonly cancellable = input(false);

  readonly saved = output<ProfileDraft>();
}
