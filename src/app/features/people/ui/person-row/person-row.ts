import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { DiscoveredUserResponse } from '../../../../core/auth/auth.models';
import { languageNameFor } from '../../../../core/utils/language-codes';
import { avatarChipClassFor } from '../../../../shared/utils/avatar-chip.utils';

@Component({
  selector: 'app-person-row',
  imports: [MatButtonModule, MatIconModule, MatListModule, MatMenuModule],
  host: {
    class: 'person',
  },
  templateUrl: './person-row.html',
  styleUrl: './person-row.scss',
})
export class PersonRow {
  readonly person = input.required<DiscoveredUserResponse>();
  readonly busy = input(false);
  readonly followToggle = output<DiscoveredUserResponse>();
  readonly blockUser = output<DiscoveredUserResponse>();

  readonly initial = computed(() => {
    const p = this.person();
    return (p.displayName.trim()[0] ?? p.username[0] ?? 'U').toUpperCase();
  });
  readonly chipClass = computed(() => avatarChipClassFor(this.person().id));
  readonly languages = computed(() => `Speaks ${languageNameFor(this.person().nativeLanguage)}`);
}
