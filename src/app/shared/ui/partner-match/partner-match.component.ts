import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { msg } from '@shared/utils/i18n/msg';
import { languageOf } from '@shared/utils/languages';
import type { PartnerMatch } from '@shared/utils/people';

@Component({
  selector: 'app-partner-match',
  imports: [TranslatePipe],
  template: `
    @if (view(); as shown) {
      <section class="match" [class.exchange]="shown.exchange" role="note">
        <i class="pi pi-arrow-right-arrow-left" aria-hidden="true"></i>
        <div>
          <strong>{{ shown.title | t }}</strong>
          <p>{{ shown.text | t: { speak: shown.speak | t, learn: shown.learn | t } }}</p>
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
          title: msg('Language exchange match'),
          text: msg(
            'Speaks {speak}, which you are learning, and is learning {learn}, which you speak.',
          ),
          speak: languageOf(match.theySpeak).name,
          learn: languageOf(match.theyLearn).name,
        };
      case 'teaches-you':
        return {
          exchange: false,
          title: msg('Can help you practise'),
          text: msg('Speaks {speak}, which you are learning.'),
          speak: languageOf(match.theySpeak).name,
          learn: '',
        };
      case 'learns-yours':
        return {
          exchange: false,
          title: msg('You can help them practise'),
          text: msg('Is learning {learn}, which you speak.'),
          speak: '',
          learn: languageOf(match.theyLearn).name,
        };
      default:
        return undefined;
    }
  });
}
