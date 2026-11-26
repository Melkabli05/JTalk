import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { SocialStatsResponse, UserProfileResponse } from '../../../../core/auth/auth.models';
import { languageNameFor } from '../../../../core/utils/language-codes';
import { AvatarArt } from '../../../../shared/ui/avatar-art/avatar-art';

function formatJoinedMonth(isoDate: string | undefined): string {
  if (!isoDate) return '';
  const parsed = new Date(isoDate);
  return Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

@Component({
  selector: 'app-profile-header',
  imports: [MatCardModule, MatButtonModule, MatIconModule, AvatarArt],
  templateUrl: './profile-header.html',
  styleUrl: './profile-header.scss',
})
export class ProfileHeader {
  readonly profile = input<UserProfileResponse | null>(null);
  readonly stats = input<SocialStatsResponse | null>(null);
  readonly editProfile = output<void>();

  readonly name = computed(() => this.profile()?.displayName || 'Speaker');
  readonly username = computed(() => this.profile()?.username ?? '');
  readonly joined = computed(() => formatJoinedMonth(this.profile()?.createdAt));
  readonly speak = computed(() => languageNameFor(this.profile()?.nativeLanguage));
  readonly learn = computed(() => {
    const code = this.profile()?.learningLanguages[0]?.languageCode;
    return code ? languageNameFor(code) : null;
  });
  readonly avatarAriaLabel = computed(() => `${this.name()}'s profile picture`);
}
