import { Component, effect, inject, signal } from '@angular/core';
import { MessageService } from '@openng/optimus-ui/api';
import { Card } from '@openng/optimus-ui/card';
import { ProgressSpinner } from '@openng/optimus-ui/progressspinner';
import type { ProfileDraft } from '@core/auth/identity.models';
import { IdentityService } from '@core/auth/identity.service';
import { ProfileFormComponent } from '@core/auth/ui/profile-form/profile-form.component';
import { PersonCardService } from '@core/people/person-card.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { SocialStatsComponent } from '@shared/ui/social-stats/social-stats.component';
import { I18n } from '@shared/utils/i18n/i18n.service';
import { ProfileAboutComponent } from '../../ui/profile-about/profile-about.component';
import { ProfileHeroComponent } from '../../ui/profile-hero/profile-hero.component';

@Component({
  selector: 'app-profile-page',
  imports: [
    Card,
    ProfileAboutComponent,
    ProfileFormComponent,
    ProfileHeroComponent,
    ProgressSpinner,
    SocialStatsComponent,
    TranslatePipe,
  ],
  providers: [PersonCardService],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
})
export default class ProfilePageComponent {
  private readonly toast = inject(MessageService);
  private readonly i18n = inject(I18n);

  protected readonly identity = inject(IdentityService);
  protected readonly cards = inject(PersonCardService);
  protected readonly locale = this.i18n.locale;
  private readonly saving = signal(false);

  constructor() {
    effect(() => {
      this.cards.show(this.identity.userId());
    });
  }

  protected async save(draft: ProfileDraft): Promise<void> {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    try {
      await this.identity.saveProfile(draft);
      this.cards.reload();
      this.toast.add({ severity: 'success', summary: this.i18n.t('Profile saved.') });
    } catch {
      this.toast.add({
        severity: 'error',
        summary: this.i18n.t('Could not save your profile. Please try again.'),
      });
    } finally {
      this.saving.set(false);
    }
  }
}
