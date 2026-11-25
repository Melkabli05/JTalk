import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { UserProfile } from '../../../../core/models/session.model';
import { AvatarArt } from '../../../../shared/ui/avatar-art/avatar-art';

@Component({
  selector: 'app-profile-header',
  imports: [MatCardModule, MatButtonModule, MatIconModule, AvatarArt],
  templateUrl: './profile-header.html',
  styleUrl: './profile-header.scss',
})
export class ProfileHeader {
  readonly profile = input.required<UserProfile>();
  readonly editProfile = output<void>();
  readonly avatarAriaLabel = computed(() => `${this.profile().name}'s profile picture`);
}
