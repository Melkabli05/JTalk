import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import type { UserProfileResponse } from '../../../../core/auth/auth.models';
import type { ThemePreference } from '../../../../core/models/theme.model';

@Component({
  selector: 'app-profile-account',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatDividerModule,
    MatIconModule,
    MatListModule,
  ],
  templateUrl: './profile-account.html',
  styleUrl: './profile-account.scss',
})
export class ProfileAccount {
  readonly profile = input<UserProfileResponse | null>(null);
  readonly authEmail = input<string | null>(null);
  readonly themePreference = input<ThemePreference>('system');
  readonly canInstall = input(false);
  readonly showIosInstallHint = input(false);
  readonly deleting = input(false);

  readonly themePreferenceChange = output<ThemePreference>();
  readonly helpClicked = output<void>();
  readonly installClicked = output<void>();
  readonly signOutClicked = output<void>();
  readonly deleteClicked = output<void>();
}
