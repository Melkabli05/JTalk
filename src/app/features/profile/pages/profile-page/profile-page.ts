import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, viewChild } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import type { ProficiencyLevel } from '../../../../core/auth/auth.models';
import { LANGUAGE_CATALOG, languageNameFor } from '../../../../core/utils/language-codes';
import type { ProfileEditSaveEvent } from '../../models/profile.model';
import { ProfileFacade } from '../../store/profile.facade';
import { DeleteAccountDialog } from '../../ui/delete-account-dialog/delete-account-dialog';
import { ProfileAccount } from '../../ui/profile-account/profile-account';
import { ProfileEditForm } from '../../ui/profile-edit-form/profile-edit-form';
import { ProfileHeader } from '../../ui/profile-header/profile-header';
import { ProfileOverview } from '../../ui/profile-overview/profile-overview';

@Component({
  selector: 'app-profile-page',
  imports: [
    NgTemplateOutlet,
    FormField,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatTabsModule,
    ProfileHeader,
    ProfileOverview,
    ProfileEditForm,
    ProfileAccount,
  ],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
})
export class ProfilePage {
  readonly facade = inject(ProfileFacade);
  private readonly dialog = inject(MatDialog);
  private readonly editForm = viewChild(ProfileEditForm);

  readonly levels: readonly ProficiencyLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'FLUENT'];
  readonly languages = LANGUAGE_CATALOG;
  readonly languageName = languageNameFor;

  formatLevel(value: ProficiencyLevel | null | undefined): string {
    return value ? value.charAt(0) + value.slice(1).toLowerCase() : '';
  }

  onProfileSaved(event: ProfileEditSaveEvent): void {
    this.facade.saveProfile(event, () => this.editForm()?.clearPendingAvatar());
  }

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
