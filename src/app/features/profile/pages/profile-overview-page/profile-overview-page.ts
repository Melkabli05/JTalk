import { NgTemplateOutlet } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import type { ProfileConnectionList } from '../../models/profile.model';
import { ProfileFacade } from '../../store/profile.facade';
import { ProfileHeader } from '../../ui/profile-header/profile-header';
import { ProfileOverview } from '../../ui/profile-overview/profile-overview';

@Component({
  selector: 'app-profile-overview-page',
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    ProfileHeader,
    ProfileOverview,
  ],
  templateUrl: './profile-overview-page.html',
  styleUrl: './profile-overview-page.scss',
})
export class ProfileOverviewPage {
  readonly facade = inject(ProfileFacade);
  private readonly router = inject(Router);

  goToEdit(fragment?: string): void {
    void this.router.navigate(['/profile', 'edit'], fragment ? { fragment } : undefined);
  }

  openConnections(list: ProfileConnectionList): void {
    this.facade.loadConnections(list);
  }

  onConnectionSegmentChange(value: unknown): void {
    if (value === 'followers' || value === 'following' || value === 'blocks') {
      this.facade.loadConnections(value);
    }
  }
}
