import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { Router, RouterLink } from '@angular/router';
import type { DiscoveredUserResponse } from '../../../../core/auth/auth.models';
import { SkeletonLoader } from '../../../../shared/ui/skeleton-loader/skeleton-loader';
import type { HostProfileDialogData } from '../../../room/models/live-room.model';
import { HostProfileDialog } from '../../../room/ui/host-profile-dialog/host-profile-dialog';
import { PeopleFacade } from '../../store/people.facade';
import { PersonRow } from '../../ui/person-row/person-row';

@Component({
  selector: 'app-people-page',
  imports: [
    NgTemplateOutlet,
    RouterLink,
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
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly facade = inject(PeopleFacade);

  openPersonProfile(person: DiscoveredUserResponse): void {
    this.facade.loadProfilePreview(person.id, (data) => {
      if (this.destroyRef.destroyed) return;
      const ref = this.dialog.open<HostProfileDialog, HostProfileDialogData, string>(
        HostProfileDialog,
        {
          width: '560px',
          maxWidth: 'calc(100vw - 24px)',
          data,
        },
      );
      ref.afterClosed().subscribe((action) => {
        if (!this.destroyRef.destroyed && data.isYou && action === 'view-profile') {
          void this.router.navigate(['/profile']);
        }
      });
    });
  }
}
