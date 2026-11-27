import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import type { UserProfileResponse } from '../../../../core/auth/auth.models';
import {
  buildOrderedLanguageRows,
  type ProfileLanguageRow,
} from '../../utils/profile-format.utils';
import { LanguageList } from '../language-list/language-list';

@Component({
  selector: 'app-profile-overview',
  imports: [MatButtonModule, MatDividerModule, MatIconModule, LanguageList],
  templateUrl: './profile-overview.html',
  styleUrl: './profile-overview.scss',
})
export class ProfileOverview {
  readonly profile = input<UserProfileResponse | null>(null);
  readonly isOwner = input(true);

  readonly addBio = output<void>();

  readonly trimmedBio = computed(() => this.profile()?.bio?.trim() ?? '');
  readonly languageRows = computed<readonly ProfileLanguageRow[]>(() => {
    const p = this.profile();
    return p ? buildOrderedLanguageRows(p) : [];
  });
}
