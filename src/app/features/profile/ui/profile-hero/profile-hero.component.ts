import { Component, computed, input } from '@angular/core';
import { Avatar } from '@openng/optimus-ui/avatar';
import { Tag } from '@openng/optimus-ui/tag';
import type { Person } from '@core/auth/identity.models';
import { InitialsPipe } from '@shared/pipes/initials.pipe';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { avatarUrl } from '@shared/utils/avatars';
import { languageOf } from '@shared/utils/languages';

/** Who the person is, as others see them: picture, name and the two languages of the exchange. */
@Component({
  selector: 'app-profile-hero',
  imports: [Avatar, InitialsPipe, Tag, TranslatePipe],
  templateUrl: './profile-hero.component.html',
  styleUrl: './profile-hero.component.scss',
})
export class ProfileHeroComponent {
  readonly person = input.required<Person>();

  protected readonly picture = computed(() => avatarUrl(this.person().avatar));
  protected readonly native = computed(() => languageOf(this.person().nativeLanguage));
  protected readonly learning = computed(() => languageOf(this.person().learning));
}
