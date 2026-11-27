import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ProfileFacade } from '../../store/profile.facade';
import { DeleteAccountDialog } from '../../ui/delete-account-dialog/delete-account-dialog';
import { ProfileAccount } from '../../ui/profile-account/profile-account';

@Component({
  selector: 'app-profile-account-page',
  imports: [ProfileAccount],
  styles: ':host { display: block; width: 100%; min-width: 0; }',
  template: `
    <app-profile-account
      [profile]="facade.me()"
      [authEmail]="facade.authEmail()"
      [themePreference]="facade.themePreference()"
      [canInstall]="facade.canInstall()"
      [showIosInstallHint]="facade.isIosInstallable()"
      [deleting]="facade.deletingAccount()"
      (themePreferenceChange)="facade.setThemePreference($event)"
      (helpClicked)="
        facade.notify(
          'Open the audio menu in a room to choose a microphone or check noise isolation.'
        )
      "
      (installClicked)="facade.promptInstall()"
      (signOutClicked)="facade.signOut()"
      (deleteClicked)="openDeleteDialog()"
    />
  `,
})
export class ProfileAccountPage {
  readonly facade = inject(ProfileFacade);
  private readonly dialog = inject(MatDialog);

  openDeleteDialog(): void {
    const ref = this.dialog.open<DeleteAccountDialog, void, boolean>(DeleteAccountDialog, {
      width: '440px',
      maxWidth: 'calc(100vw - 24px)',
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.facade.deleteAccount();
      }
    });
  }
}
