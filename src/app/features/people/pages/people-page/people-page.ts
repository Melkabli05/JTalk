import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { ActivatedRoute, Router } from '@angular/router';
import type { DiscoveredUserResponse } from '../../../../core/auth/auth.models';
import { ToastNotifier } from '../../../../core/services/toast-notifier';
import { SkeletonLoader } from '../../../../shared/ui/skeleton-loader/skeleton-loader';
import { PeopleStore } from '../../store/people-store';
import { PersonRow } from '../../ui/person-row/person-row';

@Component({
  selector: 'app-people-page',
  providers: [PeopleStore],
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    PersonRow,
    SkeletonLoader,
  ],
  templateUrl: './people-page.html',
  styleUrl: './people-page.scss',
})
export class PeoplePage {
  readonly peopleStore = inject(PeopleStore);
  private readonly toast = inject(ToastNotifier);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  onQueryChange(raw: string): void {
    this.peopleStore.setQuery(raw);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: raw.trim() ? raw : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  async onFollowToggle(person: DiscoveredUserResponse): Promise<void> {
    const res = await this.peopleStore.toggleFollow(person);
    if (this.destroyRef.destroyed) return;
    if (res.ok) {
      this.toast.show(
        res.followed ? `Following ${person.displayName}.` : `Unfollowed ${person.displayName}.`,
      );
    } else if (res.error) {
      this.toast.show(res.error);
    }
  }

  async onBlockUser(person: DiscoveredUserResponse): Promise<void> {
    const res = await this.peopleStore.blockUser(person);
    if (this.destroyRef.destroyed) return;
    if (res.ok) {
      this.toast.show(`Blocked ${person.displayName}.`);
    } else if (res.error) {
      this.toast.show(res.error);
    }
  }
}
