import { Component, effect, inject, signal } from '@angular/core';
import { MessageService } from '@openng/optimus-ui/api';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Card } from '@openng/optimus-ui/card';
import { Message } from '@openng/optimus-ui/message';
import { ProgressSpinner } from '@openng/optimus-ui/progressspinner';
import type { ProfileDraft } from '@core/auth/identity.models';
import { IdentityService } from '@core/auth/identity.service';
import { ProfileFormComponent } from '@core/auth/ui/profile-form/profile-form.component';
import { PersonCardService } from '@core/people/person-card.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { SocialStatsComponent } from '@shared/ui/social-stats/social-stats.component';
import { I18n } from '@shared/utils/i18n/i18n.service';
import { msg } from '@shared/utils/i18n/msg';
import { saveRequest } from '@shared/utils/save-request';
import { DeleteAccountDialogComponent } from '../../ui/delete-account-dialog/delete-account-dialog.component';
import { ProfileAboutComponent } from '../../ui/profile-about/profile-about.component';
import { ProfileHeroComponent } from '../../ui/profile-hero/profile-hero.component';

@Component({
  selector: 'app-profile-page',
  imports: [
    ButtonDirective,
    Card,
    DeleteAccountDialogComponent,
    Message,
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
  protected readonly saving = saveRequest();
  protected readonly deleting = saveRequest();
  protected readonly confirmingDelete = signal(false);

  constructor() {
    effect(() => {
      this.cards.show(this.identity.userId());
    });
  }

  /** Deletes the account and signs out: the page is left by the sign-out, so there is nothing to do once it succeeds. */
  protected deleteAccount(): void {
    this.deleting.run(this.identity.deleteAccount(), {
      next: () => undefined,
      failure: msg('Could not delete your account. Please try again.'),
    });
  }

  protected save(draft: ProfileDraft): void {
    this.saving.run(this.identity.saveProfile(draft), {
      next: () => {
        this.cards.reload();
        this.toast.add({ severity: 'success', summary: this.i18n.t('Profile saved.') });
      },
      failure: msg('Could not save your profile. Please try again.'),
    });
  }
}
