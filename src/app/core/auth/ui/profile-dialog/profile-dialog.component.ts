import { Component, input, model, output } from '@angular/core';
import { Dialog } from '@openng/optimus-ui/dialog';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { BrandMarkComponent } from '@shared/ui/brand-mark/brand-mark.component';
import type { Person, ProfileDraft } from '../../identity.models';
import { ProfileFormComponent } from '../profile-form/profile-form.component';

/**
 * The profile form in a modal dialog. Until the person has a profile it cannot be dismissed (`cancellable` is false):
 * the app is not usable without one. The form is created each time the dialog opens, so it always starts fresh.
 */
@Component({
  selector: 'app-profile-dialog',
  imports: [BrandMarkComponent, Dialog, ProfileFormComponent, TranslatePipe],
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
        <div class="intro">
          <app-brand-mark aria-hidden="true" />
          <p>
            {{
              'Tell us who you are before you join a room. For now this is only for testing.' | t
            }}
          </p>
        </div>
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
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-block-end: 1.25rem;
      padding-block-end: 1rem;
      border-block-end: 1px solid var(--p-content-border-color);

      app-brand-mark {
        font-size: 1.75rem;
      }

      p {
        margin: 0;
        color: var(--p-text-muted-color);
      }
    }
  `,
})
export class ProfileDialogComponent {
  readonly visible = model(false);
  readonly profile = input<Person>();
  readonly cancellable = input(false);

  readonly saved = output<ProfileDraft>();
}
