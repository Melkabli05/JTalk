import { Component, computed, input } from '@angular/core';
import { languageOf } from '@shared/utils/languages';
import type { PartnerMatch } from '@shared/utils/people';

@Component({
  selector: 'app-partner-match',
  template: `
    @if (view(); as shown) {
      <section class="match" [class.exchange]="shown.exchange" role="note">
        <i class="pi pi-arrow-right-arrow-left" aria-hidden="true"></i>
        <div>
          <strong>{{ shown.title }}</strong>
          <p>{{ shown.text }}</p>
        </div>
      </section>
    }
  `,
  styleUrl: './partner-match.component.scss',
})
export class PartnerMatchComponent {
  readonly match = input<PartnerMatch | undefined>();

  protected readonly view = computed(() => {
    const match = this.match();
    switch (match?.kind) {
      case 'exchange':
        return {
          exchange: true,
          title: 'Language exchange match',
          text: `Speaks ${languageOf(match.theySpeak).name}, which you are learning, and is learning ${languageOf(match.theyLearn).name}, which you speak.`,
        };
      case 'teaches-you':
        return {
          exchange: false,
          title: 'Can help you practise',
          text: `Speaks ${languageOf(match.theySpeak).name}, which you are learning.`,
        };
      case 'learns-yours':
        return {
          exchange: false,
          title: 'You can help them practise',
          text: `Is learning ${languageOf(match.theyLearn).name}, which you speak.`,
        };
      default:
        return undefined;
    }
  });
}
