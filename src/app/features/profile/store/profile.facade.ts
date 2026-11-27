import {
  DestroyRef,
  inject,
  type ResourceStatus,
  Service,
  type Signal,
} from '@angular/core';
import { Router } from '@angular/router';
import type {
  LanguageType,
  ProficiencyLevel,
  ProfileLoadStatus,
  ProfileSaveResult,
  SocialStatsResponse,
  UserProfileResponse,
  UserSummaryResponse,
} from '../../../core/auth/auth.models';
import { IdentityStore } from '../../../core/auth/identity';
import { UsersApi } from '../../../core/auth/users-api';
import { errorMessage } from '../../../core/http/http-error.interceptor';
import {
  type ColorScheme,
  isColorScheme,
  isThemePreference,
  type ThemePreference,
} from '../../../core/models/theme.model';
import { PwaService } from '../../../core/services/pwa';
import { ThemeService } from '../../../core/services/theme';
import { ToastNotifier } from '../../../core/services/toast-notifier';
import { LiveRoomStore } from '../../room/store/live-room-store';
import type { ProfileConnectionList, ProfileEditSaveEvent } from '../models/profile.model';
import type { ProfileLanguageRow } from '../utils/profile-format.utils';
import { ProfileStore } from './profile.store';

/**
 * Profile feature facade: coordinates profile mutations, language matrix updates,
 * theme/PWA preferences, toasts, and navigation on top of {@link ProfileStore}.
 */
@Service({ autoProvided: false })
export class ProfileFacade {
  private readonly store = inject(ProfileStore);
  private readonly theme = inject(ThemeService);
  private readonly pwa = inject(PwaService);
  private readonly identity = inject(IdentityStore);
  private readonly usersApi = inject(UsersApi);
  private readonly roomStore = inject(LiveRoomStore);
  private readonly toast = inject(ToastNotifier, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  readonly languageBusy: Signal<boolean> = this.store.languageBusy;
  readonly unblockingIds: Signal<ReadonlySet<string>> = this.store.unblockingIds;
  readonly me: Signal<UserProfileResponse | null> = this.store.me;
  readonly socialStats: Signal<SocialStatsResponse | undefined> = this.store.socialStats;
  readonly profileStatus: Signal<ProfileLoadStatus> = this.store.profileStatus;
  readonly meRetrying: Signal<boolean> = this.store.meRetrying;
  readonly profileError: Signal<string | null> = this.store.profileError;
  readonly hasProfile: Signal<boolean> = this.store.hasProfile;
  readonly needsOnboarding: Signal<boolean> = this.store.needsOnboarding;
  readonly savingProfile: Signal<boolean> = this.store.savingProfile;
  readonly deletingAccount: Signal<boolean> = this.store.deletingAccount;
  readonly authEmail: Signal<string | null> = this.store.authEmail;
  readonly isInLiveRoom: Signal<boolean> = this.store.isInLiveRoom;
  readonly maxLanguages = this.store.maxLanguages;
  readonly languageRows: Signal<readonly ProfileLanguageRow[]> = this.store.languageRows;
  readonly totalLanguages: Signal<number> = this.store.totalLanguages;
  readonly colorScheme: Signal<ColorScheme> = this.store.colorScheme;
  readonly themePreference: Signal<ThemePreference> = this.store.themePreference;
  readonly canInstall: Signal<boolean> = this.store.canInstall;
  readonly isIosInstallable: Signal<boolean> = this.store.isIosInstallable;
  readonly connectionList: Signal<ProfileConnectionList | null> = this.store.connectionList;
  readonly connectionsStatus: Signal<ResourceStatus> = this.store.connectionsStatus;
  readonly connectionsBusy: Signal<boolean> = this.store.connectionsBusy;
  readonly connectionsError: Signal<string | null> = this.store.connectionsError;
  readonly connections: Signal<readonly UserSummaryResponse[]> = this.store.connections;
  readonly moreConnections: Signal<boolean> = this.store.moreConnections;

  loadMe(): void {
    this.identity.loadMe();
  }

  retryConnections(): void {
    this.store.retryConnections();
  }

  closeConnections(): void {
    this.store.closeConnections();
  }

  loadConnections(list: ProfileConnectionList, append = false): void {
    this.store.loadConnections(list, append);
  }

  unblock(id: string): void {
    if (this.store.unblockingIds().has(id)) return;
    this.store.setUnblocking(id, true);
    this.usersApi.unblock(id).subscribe({
      next: () => {
        this.store.setUnblocking(id, false);
        if (this.connectionList() === 'blocks') this.loadConnections('blocks');
      },
      error: (err: unknown) => {
        this.store.setUnblocking(id, false);
        if (!this.destroyRef.destroyed) {
          this.toast?.show(errorMessage(err, 'Could not unblock account.'));
        }
      },
    });
  }

  changeLanguage(
    code: string,
    type?: LanguageType,
    proficiencyLevel?: ProficiencyLevel,
    onDone?: (ok: boolean, error?: string) => void,
  ): void {
    if (this.store.languageBusy()) return;
    this.store.setLanguageBusy(true);

    const req$ = !type
      ? this.usersApi.removeMyLanguage(code)
      : this.usersApi.addMyLanguage({
          languageCode: code,
          languageType: type,
          ...(type === 'LEARNING' && proficiencyLevel ? { proficiencyLevel } : {}),
        });

    req$.subscribe({
      next: (matrix) => {
        this.store.setLanguageBusy(false);
        this.identity.applyLanguageMatrix(matrix);
        onDone?.(true);
      },
      error: (err: unknown) => {
        this.store.setLanguageBusy(false);
        const msg = errorMessage(err, 'Could not update languages.');
        if (!this.destroyRef.destroyed) {
          this.toast?.show(msg);
        }
        onDone?.(false, msg);
      },
    });
  }

  setPrimaryNativeLanguage(code: string): void {
    const current = this.me();
    if (!current || this.store.languageBusy() || current.nativeLanguage === code) return;
    this.store.setLanguageBusy(true);
    this.identity.patchMe({ nativeLanguage: code }).subscribe({
      next: () => {
        this.store.setLanguageBusy(false);
        if (!this.destroyRef.destroyed) {
          this.toast?.show('Primary language updated.');
        }
      },
      error: (err: unknown) => {
        this.store.setLanguageBusy(false);
        if (!this.destroyRef.destroyed) {
          this.toast?.show(errorMessage(err, 'Could not update primary language.'));
        }
      },
    });
  }

  setThemePreference(value: unknown): void {
    if (isThemePreference(value)) {
      this.theme.setPreference(value);
    }
  }

  setColorScheme(value: unknown): void {
    if (isColorScheme(value)) {
      this.theme.setColorScheme(value);
    }
  }

  promptInstall(): void {
    this.pwa.promptInstall((outcome) => {
      if (outcome === 'accepted' && !this.destroyRef.destroyed) {
        this.toast?.show('Jtalk installed.');
      }
    });
  }

  saveProfile(event: ProfileEditSaveEvent, onResult?: (res: ProfileSaveResult) => void): void {
    const wasOnboarding = this.identity.needsOnboarding();
    this.identity.saveProfile(event.input, event.avatarBlob, (res) => {
      if (this.destroyRef.destroyed) return;
      onResult?.(res);
      if (res.ok) {
        this.toast?.show(wasOnboarding ? 'Profile created.' : 'Profile saved.');
        if (wasOnboarding) {
          void this.router?.navigate(['/rooms']);
        }
      } else {
        this.toast?.show(res.error ?? 'Could not save profile.');
      }
    });
  }

  discardProfile(): void {
    this.toast?.show('Changes discarded.');
  }

  notify(message: string): void {
    this.toast?.show(message);
  }

  signOut(): void {
    this.roomStore.signOut();
  }

  deleteAccount(): void {
    this.identity.deleteAccount((res) => {
      if (res.ok) {
        this.roomStore.rememberRoom(null);
      } else if (res.error && !this.destroyRef.destroyed) {
        this.toast?.show(res.error);
      }
    });
  }
}
