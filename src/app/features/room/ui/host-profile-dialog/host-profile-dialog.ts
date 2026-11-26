import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { UserProfileResponse, SocialStatsResponse } from '../../../../core/auth/auth.models';
import { languageFlagFor, languageNameFor } from '../../../../core/utils/language-codes';
import { AvatarArt } from '../../../../shared/ui/avatar-art/avatar-art';
import { ProfilePreviewTarget } from '../../models/live-room.model';

export interface HostProfileDialogData {
  target: ProfilePreviewTarget;
  profile: UserProfileResponse;
  stats: SocialStatsResponse;
  isYou: boolean;
}

@Component({
  selector: 'app-host-profile-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatDividerModule, AvatarArt],
  templateUrl: './host-profile-dialog.html',
  styleUrl: './host-profile-dialog.scss',
})
export class HostProfileDialog {
  readonly data = inject<HostProfileDialogData>(MAT_DIALOG_DATA);

  readonly previewData = computed(() => {
    const { target, profile, isYou } = this.data;
    const languages = profile.nativeLanguages.map((code) => ({
      name: languageNameFor(code),
      level: '(Native)',
    }));
    for (const entry of profile.learningLanguages) {
      languages.push({
        name: languageNameFor(entry.languageCode),
        level: entry.proficiencyLevel?.toLowerCase() ?? '',
      });
    }
    const role = target.kind === 'host' ? 'Host' : target.kind === 'speaker' ? 'Speaker' : 'Listener';
    const audio = target.kind === 'listener' ? 'In audience' : target.muted ? 'Muted' : 'On mic';
    return {
      status: [role, audio, ...(isYou ? ['You'] : [])].join(' · '),
      name: profile.displayName,
      meta: '@' + profile.username,
      avatarUrl: profile.avatarUrl ?? null,
      initial: profile.displayName.charAt(0).toUpperCase(),
      langs: languages.map((lang) => ({ ...lang, flag: languageFlagFor(lang.name) })),
    };
  });
}
