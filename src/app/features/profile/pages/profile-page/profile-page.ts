import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import type { ProfileSaveResult } from '../../../../core/auth/auth.models';
import { SkeletonLoader } from '../../../../shared/ui/skeleton-loader/skeleton-loader';
import { parseProfileTab, PROFILE_PROBLEM_TYPES } from '../../constants/profile.constants';
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
  selector: 'app-profile-page',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTabsModule,
    SkeletonLoader,
    ProfileEditForm,
  ],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
})
export class ProfilePage {
  readonly facade = inject(ProfileFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly onboardingForm = viewChild(ProfileEditForm);

  readonly onboardingErrors = signal<ProfileServerFieldErrors>({});

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly legacyTabTarget = computed(() => parseProfileTab(this.queryParams().get('tab')));

  constructor() {
    effect(() => {
      const legacyTab = this.legacyTabTarget();
      if (!legacyTab) return;
      const commands = legacyTab === 'overview' ? ['/profile'] : ['/profile', legacyTab];
      void this.router.navigate(commands, {
        queryParams: { tab: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }

  onOnboardingSaved(event: ProfileEditSaveEvent): void {
    this.onboardingErrors.set({});
    this.facade.saveProfile(event, (res) => this.handleOnboardingResult(res));
  }

  clearOnboardingError(field: 'username' | 'avatar' | 'languages'): void {
    this.onboardingErrors.update((prev) => ({ ...prev, [field]: null }));
  }

  async onOnboardingCropRequested(file: File): Promise<void> {
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
      this.onboardingForm()?.applyCroppedAvatar(result.blob, result.previewUrl);
    });
  }

  openOnboardingAddLanguage(): void {
    const formComp = this.onboardingForm();
    if (!formComp) return;
    const data: ProfileLanguageEditorData = {
      mode: 'add',
      existingCodes: formComp.languageRows().map((row) => row.code),
      primaryNativeCode: formComp.model().nativeLanguage,
      allowNativeRole: false,
    };
    this.openLanguageEditor(data, (result) => {
      formComp.upsertOnboardingLearning(result.code, result.level ?? 'BEGINNER');
    });
  }

  openOnboardingEditLanguage(row: ProfileLanguageRow): void {
    const formComp = this.onboardingForm();
    if (!formComp || row.isPrimaryNative) return;
    const data: ProfileLanguageEditorData = {
      mode: 'edit',
      existingCodes: formComp.languageRows().map((r) => r.code),
      primaryNativeCode: formComp.model().nativeLanguage,
      initialCode: row.code,
      initialRole: 'LEARNING',
      initialLevel: row.level ?? 'BEGINNER',
      allowNativeRole: false,
    };
    this.openLanguageEditor(data, (result) => {
      formComp.upsertOnboardingLearning(result.code, result.level ?? 'BEGINNER');
    });
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

  private handleOnboardingResult(res: ProfileSaveResult): void {
    if (res.ok) {
      this.onboardingForm()?.clearPendingAvatar();
      this.onboardingErrors.set({});
      return;
    }
    if (
      res.errorType === PROFILE_PROBLEM_TYPES.usernameTaken ||
      res.errorType === PROFILE_PROBLEM_TYPES.usernameChangeTooSoon
    ) {
      this.onboardingErrors.set({ username: res.error ?? 'Username cannot be used.' });
      return;
    }
    if (res.errorType === PROFILE_PROBLEM_TYPES.avatarInvalid) {
      this.onboardingErrors.set({ avatar: res.error ?? 'Picture could not be uploaded.' });
    }
  }
}
