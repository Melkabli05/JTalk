import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { UserProfile } from '../../../../core/models/session.model';

@Component({
  selector: 'app-profile-overview',
  imports: [MatCardModule, MatDividerModule],
  templateUrl: './profile-overview.html',
  styleUrl: './profile-overview.scss',
})
export class ProfileOverview {
  readonly profile = input.required<UserProfile>();
  readonly trimmedBio = computed(() => this.profile().about.trim());
}
