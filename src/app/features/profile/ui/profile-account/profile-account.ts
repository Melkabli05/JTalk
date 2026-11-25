import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { UserProfile } from '../../../../core/models/session.model';

@Component({
  selector: 'app-profile-account',
  imports: [MatCardModule, MatListModule, MatDividerModule, MatButtonModule, MatIconModule],
  templateUrl: './profile-account.html',
  styleUrl: './profile-account.scss',
})
export class ProfileAccount {
  readonly profile = input.required<UserProfile>();
  readonly settingsClicked = output<void>();
  readonly helpClicked = output<void>();
  readonly signOutClicked = output<void>();
  readonly deleteClicked = output<void>();
}
