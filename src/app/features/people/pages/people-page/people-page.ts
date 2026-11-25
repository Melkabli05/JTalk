import { Component, DestroyRef, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { ToastNotifier } from '../../../../core/services/toast-notifier';
import { SkeletonLoader } from '../../../../shared/ui/skeleton-loader/skeleton-loader';
import { PractisingPerson } from '../../models/person.model';
import { PeopleStore } from '../../store/people-store';
import { PersonRow } from '../../ui/person-row/person-row';

@Component({
  selector: 'app-people-page',
  providers: [PeopleStore],
  imports: [
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

  async onFollowToggle(person: PractisingPerson): Promise<void> {
    const res = await this.peopleStore.toggleFollow(person);
    if (this.destroyRef.destroyed) return;
    if (res.ok) {
      this.toast.show(res.followed ? `Following ${person.name}.` : `Unfollowed ${person.name}.`);
    } else if (res.error) {
      this.toast.show(res.error);
    }
  }

  async onBlockUser(person: PractisingPerson): Promise<void> {
    const res = await this.peopleStore.blockUser(person);
    if (this.destroyRef.destroyed) return;
    if (res.ok) {
      this.toast.show(`Blocked ${person.name}.`);
    } else if (res.error) {
      this.toast.show(res.error);
    }
  }
}
