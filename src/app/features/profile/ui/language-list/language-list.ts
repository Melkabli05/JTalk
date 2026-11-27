import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PROFILE_MAX_LANGUAGES } from '../../constants/profile.constants';
import type { ProfileLanguageRow } from '../../utils/profile-format.utils';
import { LevelMeter } from '../level-meter/level-meter';

@Component({
  selector: 'app-language-list',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, LevelMeter],
  templateUrl: './language-list.html',
  styleUrl: './language-list.scss',
})
export class LanguageList {
  readonly rows = input<readonly ProfileLanguageRow[]>([]);
  readonly editable = input(false);
  readonly busy = input(false);
  readonly maxLanguages = input(PROFILE_MAX_LANGUAGES);
  readonly allowSetPrimary = input(true);

  readonly addClicked = output<void>();
  readonly editRow = output<ProfileLanguageRow>();
  readonly removeRow = output<ProfileLanguageRow>();
  readonly setPrimaryRow = output<ProfileLanguageRow>();

  readonly atLimit = computed(() => this.rows().length >= this.maxLanguages());
  readonly countText = computed(() => `${this.rows().length} / ${this.maxLanguages()}`);
}
