import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { languageFlagFor, languageNameFor } from '../../../../core/utils/language-codes';
import { AvatarArt } from '../../../../shared/ui/avatar-art/avatar-art';
import type { HostProfileDialogData } from '../../models/live-room.model';

@Component({
  selector: 'app-host-profile-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatDividerModule, AvatarArt],
  templateUrl: './host-profile-dialog.html',
  styleUrl: './host-profile-dialog.scss',
})
export class HostProfileDialog {
  readonly data = inject<HostProfileDialogData>(MAT_DIALOG_DATA);

  readonly following = signal(this.data.stats.followedByMe);
  readonly followerCount = signal(this.data.stats.followerCount);
  readonly followBusy = signal(false);

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
    const status =
      target.kind === 'member'
        ? isYou
          ? 'Profile · You'
          : 'Community member'
        : [
            target.kind === 'host'
              ? 'Host'
              : target.kind === 'speaker'
                ? 'Speaker'
                : 'Listener',
            target.kind === 'listener'
              ? 'In audience'
              : target.muted
                ? 'Muted'
                : 'On mic',
            ...(isYou ? ['You'] : []),
          ].join(' · ');
    return {
      status,
      name: profile.displayName,
      meta: '@' + profile.username,
      avatarUrl: profile.avatarUrl ?? null,
      initial: profile.displayName.charAt(0).toUpperCase(),
      langs: languages.map((lang) => ({ ...lang, flag: languageFlagFor(lang.name) })),
    };
  });

  async onToggleFollow(): Promise<void> {
    const toggle = this.data.onToggleFollow;
    if (!toggle || this.followBusy()) return;
    const next = !this.following();
    this.followBusy.set(true);
    try {
      const ok = await toggle(next);
      if (ok) {
        this.following.set(next);
        this.followerCount.update((count) => Math.max(0, count + (next ? 1 : -1)));
      }
    } finally {
      this.followBusy.set(false);
    }
  }
}
