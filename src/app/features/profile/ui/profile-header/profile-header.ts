import { Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { SocialStatsResponse, UserProfileResponse } from '../../../../core/auth/auth.models';
import type { ProfileConnectionList } from '../../models/profile.model';
import {
  displayCountryName,
  displayLanguageName,
  formatFollowerLabel,
  formatFollowingLabel,
  formatJoinedMonth,
  profileInitials,
} from '../../utils/profile-format.utils';

@Component({
  selector: 'app-profile-header',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './profile-header.html',
  styleUrl: './profile-header.scss',
})
export class ProfileHeader {
  readonly profile = input<UserProfileResponse | null>(null);
  readonly stats = input<SocialStatsResponse | null>(null);
  readonly compact = input(false);
  readonly isOwner = input(true);
  readonly isLive = input(false);
  readonly previewImageUrl = input<string | null | undefined>(undefined);
  readonly previewBio = input<string | null | undefined>(undefined);

  readonly editProfile = output<void>();
  readonly openConnections = output<Extract<ProfileConnectionList, 'followers' | 'following'>>();

  private readonly imageFailedUrl = signal<string | null>(null);

  readonly name = computed(() => this.profile()?.displayName?.trim() || 'Speaker');
  readonly initials = computed(() => profileInitials(this.name()));
  readonly username = computed(() => this.profile()?.username?.trim() ?? '');
  readonly joined = computed(() => formatJoinedMonth(this.profile()?.createdAt));
  readonly location = computed(() => displayCountryName(this.profile()?.countryCode));

  readonly avatarSrc = computed(() => {
    const override = this.previewImageUrl();
    const raw = override !== undefined ? override : (this.profile()?.avatarUrl ?? null);
    if (!raw || raw === this.imageFailedUrl()) return null;
    return raw;
  });

  readonly primaryNative = computed(() => {
    const code = this.profile()?.nativeLanguage;
    return code ? displayLanguageName(code) : null;
  });

  readonly primaryLearning = computed(() => {
    const code = this.profile()?.learningLanguages[0]?.languageCode;
    return code ? displayLanguageName(code) : null;
  });

  readonly extraLanguageCount = computed(() => {
    const p = this.profile();
    if (!p) return 0;
    const total =
      (p.nativeLanguages.length > 0 ? p.nativeLanguages.length : p.nativeLanguage ? 1 : 0) +
      p.learningLanguages.length;
    const shown = (this.primaryNative() ? 1 : 0) + (this.primaryLearning() ? 1 : 0);
    return Math.max(0, total - shown);
  });

  readonly followers = computed(() => formatFollowerLabel(this.stats()?.followerCount ?? 0));
  readonly following = computed(() => formatFollowingLabel(this.stats()?.followingCount ?? 0));

  readonly avatarAriaLabel = computed(() => `${this.name()}'s profile picture`);

  onImageError(url: string): void {
    this.imageFailedUrl.set(url);
  }
}
