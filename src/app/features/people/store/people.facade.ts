import { DestroyRef, inject, type ResourceStatus, Service, type Signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import type {
  DiscoveredUserResponse,
  UserProfileResponse,
} from '../../../core/auth/auth.models';
import { IdentityStore } from '../../../core/auth/identity';
import { UsersApi } from '../../../core/auth/users-api';
import { errorMessage } from '../../../core/http/http-error.interceptor';
import { ToastNotifier } from '../../../core/services/toast-notifier';
import type { HostProfileDialogData } from '../../room/models/live-room.model';
import { PeopleStore } from './people.store';

/**
 * People feature facade: coordinates follow/block actions, profile preview loading,
 * query-param sync, and toast feedback on top of {@link PeopleStore}.
 */
@Service({ autoProvided: false })
export class PeopleFacade {
  private readonly store = inject(PeopleStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly usersApi = inject(UsersApi);
  private readonly identity = inject(IdentityStore);
  private readonly toast = inject(ToastNotifier, { optional: true });
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });

  private profilePreviewSeq = 0;

  readonly query: Signal<string> = this.store.query;
  readonly searching: Signal<boolean> = this.store.searching;
  readonly status: Signal<ResourceStatus> = this.store.status;
  readonly loading: Signal<boolean> = this.store.loading;
  readonly error: Signal<string | null> = this.store.error;
  readonly needsLearningLanguage: Signal<boolean> = this.store.needsLearningLanguage;
  readonly hasMore: Signal<boolean> = this.store.hasMore;
  readonly busyIds: Signal<ReadonlySet<string>> = this.store.busyIds;
  readonly people: Signal<readonly DiscoveredUserResponse[]> = this.store.people;

  setQuery(raw: string): void {
    this.store.setQuery(raw);
    const trimmed = raw.trim();
    if (this.route && this.router) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { q: trimmed.length > 0 ? trimmed : null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  refresh(): void {
    this.store.refresh();
  }

  loadMore(): void {
    this.store.loadMore();
  }

  toggleFollow(person: DiscoveredUserResponse): void {
    if (this.store.busyIds().has(person.id)) return;
    this.store.setPending(person.id, true);
    const followed = !person.followedByMe;
    (followed ? this.usersApi.follow(person.id) : this.usersApi.unfollow(person.id)).subscribe({
      next: () => {
        this.store.setPending(person.id, false);
        this.store.setFollowOverride(person.id, followed);
        this.identity.refreshSocialStats();
        if (!this.destroyRef.destroyed) {
          this.toast?.show(
            followed ? `Following ${person.displayName}.` : `Unfollowed ${person.displayName}.`,
          );
        }
      },
      error: (err: unknown) => {
        this.store.setPending(person.id, false);
        if (!this.destroyRef.destroyed) {
          this.toast?.show(errorMessage(err, 'Could not update follow status.'));
        }
      },
    });
  }

  blockUser(person: DiscoveredUserResponse): void {
    if (this.store.busyIds().has(person.id)) return;
    this.store.setPending(person.id, true);
    this.usersApi.block(person.id).subscribe({
      next: () => {
        this.store.setPending(person.id, false);
        this.store.markBlocked(person.id);
        this.identity.refreshSocialStats();
        if (!this.destroyRef.destroyed) {
          this.toast?.show(`Blocked ${person.displayName}.`);
        }
      },
      error: (err: unknown) => {
        this.store.setPending(person.id, false);
        if (!this.destroyRef.destroyed) {
          this.toast?.show(errorMessage(err, 'Could not block user.'));
        }
      },
    });
  }

  loadProfilePreview(id: string, onReady: (data: HostProfileDialogData) => void): void {
    const seq = ++this.profilePreviewSeq;
    forkJoin([this.usersApi.getUser(id), this.usersApi.getSocialStats(id)]).subscribe({
      next: ([profile, stats]) => {
        if (this.destroyRef.destroyed || seq !== this.profilePreviewSeq) return;
        const isYou = id === this.identity.userId();
        onReady({
          profile,
          stats,
          target: { kind: 'member' },
          isYou,
          onToggleFollow: isYou
            ? undefined
            : (follow) => this.toggleFollowFromPreview(profile, follow),
        });
      },
      error: (err: unknown) => {
        if (!this.destroyRef.destroyed && seq === this.profilePreviewSeq) {
          this.toast?.show(errorMessage(err, 'Could not load this profile.'));
        }
      },
    });
  }

  private async toggleFollowFromPreview(
    profile: UserProfileResponse,
    follow: boolean,
  ): Promise<boolean> {
    try {
      await firstValueFrom(
        follow ? this.usersApi.follow(profile.id) : this.usersApi.unfollow(profile.id),
      );
      this.store.setFollowOverride(profile.id, follow);
      this.identity.refreshSocialStats();
      if (!this.destroyRef.destroyed) {
        this.toast?.show(
          follow ? `Following ${profile.displayName}.` : `Unfollowed ${profile.displayName}.`,
        );
      }
      return true;
    } catch (err: unknown) {
      if (!this.destroyRef.destroyed) {
        this.toast?.show(errorMessage(err, 'Could not update follow status.'));
      }
      return false;
    }
  }
}
