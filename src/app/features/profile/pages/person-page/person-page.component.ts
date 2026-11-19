import { Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService, type MenuItem } from '@openng/optimus-ui/api';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { ConfirmDialog } from '@openng/optimus-ui/confirmdialog';
import { Menu } from '@openng/optimus-ui/menu';
import { Message } from '@openng/optimus-ui/message';
import { ProgressSpinner } from '@openng/optimus-ui/progressspinner';
import { Tooltip } from '@openng/optimus-ui/tooltip';
import { PersonCardService } from '@core/people/person-card.service';
import { FollowButtonComponent } from '@shared/ui/follow-button/follow-button.component';
import { SocialStatsComponent } from '@shared/ui/social-stats/social-stats.component';
import { ProfileAboutComponent } from '../../ui/profile-about/profile-about.component';
import { ProfileHeroComponent } from '../../ui/profile-hero/profile-hero.component';

@Component({
  selector: 'app-person-page',
  imports: [
    ButtonDirective,
    ConfirmDialog,
    FollowButtonComponent,
    Menu,
    Message,
    ProfileAboutComponent,
    ProfileHeroComponent,
    ProgressSpinner,
    RouterLink,
    SocialStatsComponent,
    Tooltip,
  ],
  providers: [ConfirmationService, PersonCardService],
  templateUrl: './person-page.component.html',
  styleUrl: './person-page.component.scss',
})
export default class PersonPageComponent {
  private readonly confirmation = inject(ConfirmationService);
  private readonly toast = inject(MessageService);

  protected readonly cards = inject(PersonCardService);

  readonly id = input.required<string>();

  protected readonly moreActions = computed<MenuItem[]>(() => [
    {
      label: 'Block',
      icon: 'pi pi-ban',
      linkClass: 'danger-item',
      command: () => this.block(),
    },
  ]);

  constructor() {
    effect(() => {
      this.cards.show(this.id());
    });
  }

  protected block(): void {
    const name = this.cards.card()?.details.name ?? '';
    this.confirmation.confirm({
      header: `Block ${name}`,
      message: `Blocking removes any follows between you and ${name}, and you will not find each other in search or partner suggestions.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Block',
      rejectLabel: 'Cancel',
      acceptButtonProps: { severity: 'danger' },
      accept: () =>
        this.cards.block(() =>
          this.toast.add({
            severity: 'success',
            summary: `${name} is blocked.`,
          }),
        ),
    });
  }
}
