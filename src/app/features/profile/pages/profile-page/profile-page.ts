import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { form, FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, Router } from '@angular/router';
import type {
  FollowListResponse,
  LanguageType,
  ProficiencyLevel,
  UserSummaryResponse,
} from '../../../../core/auth/auth.models';
import { IdentityStore } from '../../../../core/auth/identity';
import { UsersApi } from '../../../../core/auth/users-api';
import { errorMessage } from '../../../../core/http/http-error.interceptor';
import { PwaService } from '../../../../core/services/pwa';
import { isColorScheme, ThemeService } from '../../../../core/services/theme';
import { ToastNotifier } from '../../../../core/services/toast-notifier';
import { LANGUAGE_CATALOG, languageNameFor } from '../../../../core/utils/language-codes';
import { LiveRoomStore } from '../../../room/store/live-room-store';
import {
  parseProfileTab,
  PROFILE_CONNECTIONS_PAGE_SIZE,
  PROFILE_TAB_ORDER,
  type ProfileTab,
} from '../../constants/profile.constants';
import { DeleteAccountDialog } from '../../ui/delete-account-dialog/delete-account-dialog';
import { ProfileAccount } from '../../ui/profile-account/profile-account';
import {
  ProfileEditForm,
  type ProfileEditSaveEvent,
} from '../../ui/profile-edit-form/profile-edit-form';
import { ProfileHeader } from '../../ui/profile-header/profile-header';
import { ProfileOverview } from '../../ui/profile-overview/profile-overview';

export type ProfileConnectionList = 'followers' | 'following' | 'blocks';

interface ConnectionsRequest {
  readonly userId: string;
  readonly list: ProfileConnectionList;
  readonly page: number;
}

interface AddLanguageFormModel {
  code: string;
  level: ProficiencyLevel;
}

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
  readonly theme = inject(ThemeService);
  readonly pwa = inject(PwaService);
  readonly identity = inject(IdentityStore);
  readonly toast = inject(ToastNotifier);
  private readonly usersApi = inject(UsersApi);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly roomStore = inject(LiveRoomStore);
  private readonly editForm = viewChild(ProfileEditForm);

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  private readonly addLanguageModel = signal<AddLanguageFormModel>({
    code: 'en',
    level: 'BEGINNER',
  });
  readonly addLanguageForm = form(this.addLanguageModel);
  readonly levels: readonly ProficiencyLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'FLUENT'];
  readonly languages = LANGUAGE_CATALOG;
  readonly languageName = languageNameFor;
  readonly editingLanguages = signal(false);
  readonly languageBusy = signal(false);

  private readonly connectionsRequest = signal<ConnectionsRequest | null>(null);
  private readonly connectionsRes = this.usersApi.connectionsResource(() => {
    const req = this.connectionsRequest();
    return req
      ? { userId: req.userId, list: req.list, page: req.page, size: PROFILE_CONNECTIONS_PAGE_SIZE }
      : undefined;
  });

  readonly connectionList = computed(() => this.connectionsRequest()?.list ?? null);
  readonly connectionsStatus = this.connectionsRes.status;
  readonly connectionsBusy = this.connectionsRes.isLoading;
  readonly connectionsError = computed<string | null>(() => {
    const err = this.connectionsRes.error();
    return err ? errorMessage(err, 'Could not load accounts.') : null;
  });
  readonly connections = linkedSignal<
    {
      request: ConnectionsRequest | null;
      page: FollowListResponse | UserSummaryResponse[] | undefined;
    },
    readonly UserSummaryResponse[]
  >({
    source: () => ({
      request: this.connectionsRequest(),
      page: this.connectionsRes.hasValue() ? this.connectionsRes.value() : undefined,
    }),
    computation: ({ request, page }, previous) => {
      if (!request) return [];
      if (!page) return request.page > 0 ? (previous?.value ?? []) : [];
      if (previous && page === previous.source.page) return previous.value;
      if (Array.isArray(page)) return page;
      return request.page > 0 ? [...(previous?.value ?? []), ...page.content] : page.content;
    },
  });

  readonly moreConnections = computed(() => {
    if (!this.connectionsRes.hasValue()) return false;
    const page = this.connectionsRes.value();
    return !Array.isArray(page) && (page.page + 1) * page.size < page.total;
  });

  readonly activeTab = linkedSignal<ProfileTab>(
    () =>
      parseProfileTab(this.queryParams().get('tab')) ??
      (this.identity.needsOnboarding() ? 'edit' : 'overview'),
  );

  readonly selectedTabIndex = computed(() => {
    const idx = PROFILE_TAB_ORDER.indexOf(this.activeTab());
    return idx === -1 ? 0 : idx;
  });

  retryConnections(): void {
    this.connectionsRes.reload();
  }

  loadConnections(list: ProfileConnectionList, append = false): void {
    const userId = this.identity.me()?.id;
    if (!userId) return;

    const current = this.connectionsRequest();
    if (append && (!this.moreConnections() || this.connectionsBusy() || current?.list !== list)) {
      return;
    }
    const previousPage = this.connectionsRes.hasValue() ? this.connectionsRes.value() : undefined;
    const page = append && previousPage && !Array.isArray(previousPage) ? previousPage.page + 1 : 0;
    if (current?.userId === userId && current.list === list && current.page === page) {
      this.connectionsRes.reload();
    } else {
      this.connectionsRequest.set({ userId, list, page });
    }
  }

  unblock(id: string): void {
    this.usersApi.unblock(id).subscribe({
      next: () => {
        if (this.connectionList() === 'blocks') this.loadConnections('blocks');
      },
      error: (err: unknown) => {
        if (!this.destroyRef.destroyed) {
          this.toast.show(errorMessage(err, 'Could not unblock account.'));
        }
      },
    });
  }

  formatLevel(value: ProficiencyLevel | null | undefined): string {
    return value ? value.charAt(0) + value.slice(1).toLowerCase() : '';
  }

  onInstallApp(): void {
    this.pwa.promptInstall((outcome) => {
      if (outcome === 'accepted' && !this.destroyRef.destroyed) {
        this.toast.show('Jtalk installed.');
      }
    });
  }

  changeLanguage(
    code: string,
    type?: LanguageType,
    proficiencyLevel?: ProficiencyLevel,
  ): void {
    if (this.languageBusy()) return;
    this.languageBusy.set(true);
    const req$ = type
      ? this.usersApi.addMyLanguage({
          languageCode: code,
          languageType: type,
          ...(type === 'LEARNING' && proficiencyLevel ? { proficiencyLevel } : {}),
        })
      : this.usersApi.removeMyLanguage(code);
    req$.subscribe({
      next: (matrix) => {
        this.languageBusy.set(false);
        this.identity.applyLanguageMatrix(matrix);
      },
      error: (err: unknown) => {
        this.languageBusy.set(false);
        if (!this.destroyRef.destroyed) {
          this.toast.show(errorMessage(err, 'Could not update languages.'));
        }
      },
    });
  }

  selectTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'overview' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onSelectedIndexChange(index: number): void {
    this.selectTab(PROFILE_TAB_ORDER[index] ?? 'overview');
  }

  onColorSchemeChange(value: unknown): void {
    if (isColorScheme(value)) {
      this.theme.setColorScheme(value);
    }
  }

  onProfileSaved(event: ProfileEditSaveEvent): void {
    const wasOnboarding = this.identity.needsOnboarding();
    this.identity.saveProfile(event.input, event.avatarBlob, (res) => {
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
    });
  }

  onProfileDiscarded(): void {
    this.toast.show('Changes discarded.');
  }

  openDeleteDialog(): void {
    const ref = this.dialog.open<DeleteAccountDialog, void, boolean>(DeleteAccountDialog, {
      width: '440px',
      maxWidth: 'calc(100vw - 24px)',
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed || this.destroyRef.destroyed) return;
      this.identity.deleteAccount((res) => {
        if (res.ok) {
          this.roomStore.rememberRoom(null);
        } else if (res.error && !this.destroyRef.destroyed) {
          this.toast.show(res.error);
        }
      });
    });
  }
}
