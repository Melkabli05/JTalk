import { Component, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from '@openng/optimus-ui/api';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { ConfirmDialog } from '@openng/optimus-ui/confirmdialog';
import { Message } from '@openng/optimus-ui/message';
import { ProgressSpinner } from '@openng/optimus-ui/progressspinner';
import { PersonCardService } from '@core/people/person-card.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { FollowButtonComponent } from '@shared/ui/follow-button/follow-button.component';
import { SocialStatsComponent } from '@shared/ui/social-stats/social-stats.component';
import { I18n } from '@shared/utils/i18n/i18n.service';
import { ProfileAboutComponent } from '../../ui/profile-about/profile-about.component';
import { ProfileHeroComponent } from '../../ui/profile-hero/profile-hero.component';

@Component({
  selector: 'app-person-page',
  imports: [
    ButtonDirective,
    ConfirmDialog,
    FollowButtonComponent,
    Message,
    ProfileAboutComponent,
    ProfileHeroComponent,
    ProgressSpinner,
    RouterLink,
    SocialStatsComponent,
    TranslatePipe,
  ],
  providers: [ConfirmationService, PersonCardService],
  templateUrl: './person-page.component.html',
  styleUrl: './person-page.component.scss',
})
export default class PersonPageComponent {
  private readonly confirmation = inject(ConfirmationService);
  private readonly toast = inject(MessageService);
  private readonly i18n = inject(I18n);

  protected readonly cards = inject(PersonCardService);
  protected readonly locale = this.i18n.locale;

  readonly id = input.required<string>();

  constructor() {
    effect(() => {
      this.cards.show(this.id());
    });
  }

  protected block(): void {
    const name = this.cards.card()?.details.name ?? '';
    this.confirmation.confirm({
      header: this.i18n.t('Block {name}', { name }),
      message: this.i18n.t(
        'Blocking removes any follows between you and {name}, and you will not find each other in search or partner suggestions.',
        { name },
      ),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.i18n.t('Block'),
      rejectLabel: this.i18n.t('Cancel'),
      acceptButtonProps: { severity: 'danger' },
      accept: () =>
        this.cards.block(() =>
          this.toast.add({
            severity: 'success',
            summary: this.i18n.t('{name} is blocked.', { name }),
          }),
        ),
    });
  }
}
