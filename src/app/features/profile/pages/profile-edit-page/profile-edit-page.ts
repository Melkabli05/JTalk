import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import type { ProfileSaveResult } from '../../../../core/auth/auth.models';
import { PROFILE_PROBLEM_TYPES } from '../../constants/profile.constants';
import type { HasUnsavedProfileChanges } from '../../guards/unsaved-profile.guard';
import type {
  ProfileEditSaveEvent,
  ProfileLanguageEditorData,
  ProfileLanguageEditorResult,
  ProfileServerFieldErrors,
} from '../../models/profile.model';
import { ProfileFacade } from '../../store/profile.facade';
import type {
  AvatarCropDialogData,
  AvatarCropDialogResult,
} from '../../ui/avatar-crop-dialog/avatar-crop-dialog';
import { LanguageEditorDialog } from '../../ui/language-editor-dialog/language-editor-dialog';
import { ProfileEditForm } from '../../ui/profile-edit-form/profile-edit-form';
import type { ProfileLanguageRow } from '../../utils/profile-format.utils';

@Component({
  selector: 'app-profile-edit-page',
  imports: [ProfileEditForm],
  styles: ':host { display: block; width: 100%; min-width: 0; }',
  template: `
    <app-profile-edit-form
      [profile]="facade.me()"
      [stats]="facade.socialStats() ?? null"
      [onboarding]="false"
      [saving]="facade.savingProfile()"
      [languageBusy]="facade.languageBusy()"
      [isLive]="facade.isInLiveRoom()"
      [serverErrors]="serverErrors()"
      [focusSection]="fragment()"
      (saved)="onSaved($event)"
      (discarded)="onDiscarded()"
      (cropFileRequested)="onCropFileRequested($event)"
      (avatarPicked)="facade.notify('Picture ready to save.')"
      (uploadError)="facade.notify($event)"
      (serverErrorCleared)="clearServerError($event)"
      (addLanguageRequested)="openAddLanguage()"
      (editLanguageRequested)="openEditLanguage($event)"
      (removeLanguageRequested)="onRemoveLanguage($event)"
      (setPrimaryLanguageRequested)="onSetPrimaryLanguage($event)"
    />
  `,
})
export class ProfileEditPage implements HasUnsavedProfileChanges {
  readonly facade = inject(ProfileFacade);
  private readonly dialog = inject(MatDialog);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly route = inject(ActivatedRoute);
  private readonly editForm = viewChild(ProfileEditForm);

  readonly serverErrors = signal<ProfileServerFieldErrors>({});
  readonly fragment = toSignal(this.route.fragment, {
    initialValue: this.route.snapshot.fragment,
  });

  hasUnsavedChanges(): boolean {
    return this.editForm()?.dirty() ?? false;
  }

  onSaved(event: ProfileEditSaveEvent): void {
    this.serverErrors.set({});
    this.facade.saveProfile(event, (res) => this.handleSaveResult(res));
  }

  onDiscarded(): void {
    this.serverErrors.set({});
    this.facade.discardProfile();
  }

  clearServerError(field: 'username' | 'avatar' | 'languages'): void {
    this.serverErrors.update((prev) => ({ ...prev, [field]: null }));
  }

  async onCropFileRequested(file: File): Promise<void> {
    const { AvatarCropDialog } = await import(
      '../../ui/avatar-crop-dialog/avatar-crop-dialog'
    );
    const ref = this.dialog.open<
      InstanceType<typeof AvatarCropDialog>,
      AvatarCropDialogData,
      AvatarCropDialogResult | undefined
    >(AvatarCropDialog, {
      data: { file },
      width: '400px',
      maxWidth: 'calc(100vw - 24px)',
    });
    ref.afterClosed().subscribe((result) => {
      if (!result) return;
      this.editForm()?.applyCroppedAvatar(result.blob, result.previewUrl);
    });
  }

  openAddLanguage(): void {
    const me = this.facade.me();
    if (!me) return;
    const data: ProfileLanguageEditorData = {
      mode: 'add',
      existingCodes: this.facade.languageRows().map((row) => row.code),
      primaryNativeCode: me.nativeLanguage,
      allowNativeRole: true,
    };
    this.openLanguageEditor(data, (result) => {
      this.facade.changeLanguage(result.code, result.role, result.level ?? undefined);
    });
  }

  openEditLanguage(row: ProfileLanguageRow): void {
    const me = this.facade.me();
    if (!me) return;
    const data: ProfileLanguageEditorData = {
      mode: 'edit',
      existingCodes: this.facade.languageRows().map((r) => r.code),
      primaryNativeCode: me.nativeLanguage,
      initialCode: row.code,
      initialRole: row.role,
      initialLevel: row.level ?? 'BEGINNER',
      allowNativeRole: true,
    };
    this.openLanguageEditor(data, (result) => {
      this.facade.changeLanguage(result.code, result.role, result.level ?? undefined);
    });
  }

  onRemoveLanguage(row: ProfileLanguageRow): void {
    if (row.isPrimaryNative) return;
    this.facade.changeLanguage(row.code);
  }

  onSetPrimaryLanguage(row: ProfileLanguageRow): void {
    if (row.role !== 'NATIVE' || row.isPrimaryNative) return;
    this.facade.setPrimaryNativeLanguage(row.code);
  }

  private openLanguageEditor(
    data: ProfileLanguageEditorData,
    onResult: (result: ProfileLanguageEditorResult) => void,
  ): void {
    if (this.breakpoints.isMatched('(max-width: 767px)')) {
      const sheetRef = this.bottomSheet.open<
        LanguageEditorDialog,
        ProfileLanguageEditorData,
        ProfileLanguageEditorResult | undefined
      >(LanguageEditorDialog, { data });
      sheetRef.afterDismissed().subscribe((result) => {
        if (result) onResult(result);
      });
      return;
    }
    const dialogRef = this.dialog.open<
      LanguageEditorDialog,
      ProfileLanguageEditorData,
      ProfileLanguageEditorResult | undefined
    >(LanguageEditorDialog, {
      data,
      width: '440px',
      maxWidth: 'calc(100vw - 24px)',
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) onResult(result);
    });
  }

  private handleSaveResult(res: ProfileSaveResult): void {
    if (res.ok) {
      this.editForm()?.clearPendingAvatar();
      this.serverErrors.set({});
      return;
    }
    if (
      res.errorType === PROFILE_PROBLEM_TYPES.usernameTaken ||
      res.errorType === PROFILE_PROBLEM_TYPES.usernameChangeTooSoon
    ) {
      this.serverErrors.set({ username: res.error ?? 'Username cannot be used.' });
      return;
    }
    if (res.errorType === PROFILE_PROBLEM_TYPES.avatarInvalid) {
      this.serverErrors.set({ avatar: res.error ?? 'Picture could not be uploaded.' });
    }
  }
}
