import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { LanguageType, ProficiencyLevel } from '../../../../core/auth/auth.models';
import { IdentityStore } from '../../../../core/auth/identity';
import { ProfileTab } from '../../../../core/models/session.model';
import { ToastNotifier } from '../../../../core/services/toast-notifier';
import { AppState } from '../../../../core/state/app-state';
import { LANGUAGE_CATALOG } from '../../../../core/utils/language-codes';
import { LiveRoomStore } from '../../../room/store/live-room-store';
import { PROFILE_TAB_ORDER } from '../../constants/profile.constants';
import { ProfileStore } from '../../store/profile-store';
import { DeleteAccountDialog } from '../../ui/delete-account-dialog/delete-account-dialog';
import { ProfileAccount } from '../../ui/profile-account/profile-account';
import {
  ProfileEditForm,
  ProfileEditSaveEvent,
} from '../../ui/profile-edit-form/profile-edit-form';
import { ProfileHeader } from '../../ui/profile-header/profile-header';
import { ProfileOverview } from '../../ui/profile-overview/profile-overview';

@Component({
  selector: 'app-profile-page',
  providers: [ProfileStore],
  imports: [
    FormField,
    MatButtonModule,
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
  readonly appState = inject(AppState);
  readonly identity = inject(IdentityStore);
  readonly profileStore = inject(ProfileStore);
  readonly toast = inject(ToastNotifier);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly roomStore = inject(LiveRoomStore);
  private readonly editForm = viewChild(ProfileEditForm);

  readonly level = form(signal<ProficiencyLevel>('BEGINNER'));
  readonly levels: readonly ProficiencyLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'FLUENT'];
  readonly languages = LANGUAGE_CATALOG;

  readonly activeTab = linkedSignal<ProfileTab>(() =>
    this.identity.needsOnboarding() ? 'edit' : this.appState.requestedProfileTab(),
  );

  readonly selectedTabIndex = computed(() => {
    const idx = PROFILE_TAB_ORDER.indexOf(this.activeTab());
    return idx === -1 ? 0 : idx;
  });

  constructor() {
    effect(() => {
      const error = this.profileStore.connectionsError();
      if (error) this.toast.show(error);
    });
  }

  async unblock(id: string): Promise<void> {
    const error = await this.profileStore.unblock(id);
    if (error && !this.destroyRef.destroyed) this.toast.show(error);
  }

  async changeLanguage(code: string, type?: LanguageType, level?: ProficiencyLevel): Promise<void> {
    const error = await this.profileStore.changeLanguage(code, type, level);
    if (error && !this.destroyRef.destroyed) this.toast.show(error);
  }

  selectTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
    this.appState.requestProfileTab(tab);
  }

  onSelectedIndexChange(index: number): void {
    this.selectTab(PROFILE_TAB_ORDER[index] ?? 'overview');
  }

  async onProfileSaved(event: ProfileEditSaveEvent): Promise<void> {
    const wasOnboarding = this.identity.needsOnboarding();
    const { profile, avatarBlob } = event;
    const res = await this.identity.saveProfile(
      {
        displayName: profile.name,
        username: profile.username,
        nativeLanguage: profile.speak,
        learningLanguage: profile.learn,
        location: profile.location === 'Not set' ? '' : profile.location,
        bio: profile.about,
        avatarUrl: avatarBlob ? undefined : profile.avatar.imageUrl,
      },
      avatarBlob,
    );
    if (this.destroyRef.destroyed) return;
    if (res.ok) {
      this.editForm()?.clearPendingAvatar();
      this.toast.show(wasOnboarding ? 'Profile created.' : 'Profile saved.');
      if (wasOnboarding) {
        void this.router.navigate(['/rooms']);
      }
    } else {
      this.toast.show(res.error ?? 'Could not save profile.');
    }
  }

  onProfileDiscarded(): void {
    this.toast.show('Changes discarded.');
  }

  async openDeleteDialog(): Promise<void> {
    const ref = this.dialog.open<DeleteAccountDialog, void, boolean>(DeleteAccountDialog, {
      width: '440px',
      maxWidth: 'calc(100vw - 24px)',
    });

    const confirmed = await lastValueFrom(ref.afterClosed());
    if (!confirmed || this.destroyRef.destroyed) return;
    const res = await this.identity.deleteAccount();
    if (res.ok) {
      this.appState.rememberRoom(null);
    } else if (res.error && !this.destroyRef.destroyed) {
      this.toast.show(res.error);
    }
  }
}
