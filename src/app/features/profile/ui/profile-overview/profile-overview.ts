import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { UserProfileResponse } from '../../../../core/auth/auth.models';
import { languageNameFor } from '../../../../core/utils/language-codes';

@Component({
  selector: 'app-profile-overview',
  imports: [MatCardModule, MatDividerModule],
  templateUrl: './profile-overview.html',
  styleUrl: './profile-overview.scss',
})
export class ProfileOverview {
  readonly profile = input<UserProfileResponse | null>(null);
  readonly trimmedBio = computed(() => this.profile()?.bio?.trim() ?? '');
  readonly speak = computed(() => languageNameFor(this.profile()?.nativeLanguage));
  readonly learn = computed(() => {
    const code = this.profile()?.learningLanguages[0]?.languageCode;
    return code ? languageNameFor(code) : 'Not set';
  });
}
