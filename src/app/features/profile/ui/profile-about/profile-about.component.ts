import { Component, input } from '@angular/core';
import { Card } from '@openng/optimus-ui/card';
import type { PersonCard } from '@core/people/person-card.model';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { LanguageLevelsComponent } from '@shared/ui/language-levels/language-levels.component';
import { PartnerMatchComponent } from '@shared/ui/partner-match/partner-match.component';

@Component({
  selector: 'app-profile-about',
  imports: [Card, LanguageLevelsComponent, PartnerMatchComponent, TranslatePipe],
  template: `
    <p-card>
      <h2>{{ 'About' | t }}</h2>
      @if (card().details.bio) {
        <p class="bio">{{ card().details.bio }}</p>
      } @else if (card().isMe) {
        <p class="empty">{{ 'Add a short bio so people know what you like to talk about.' | t }}</p>
      }
      <app-partner-match [match]="card().match" />
      @if (card().languages; as languages) {
        <app-language-levels [native]="languages.native" [learning]="languages.learning" />
      }
    </p-card>
  `,
  styles: `
    :host {
      display: block;
    }

    h2 {
      margin: 0 0 0.75rem;
      font-size: var(--p-jtalk-type-section);
    }

    p {
      margin: 0 0 1rem;
    }

    .bio {
      overflow-wrap: anywhere;
      white-space: pre-line;
    }

    .empty {
      color: var(--p-text-muted-color);
    }

    app-partner-match {
      margin-block-end: 1.25rem;
    }

    app-partner-match:empty {
      display: none;
    }
  `,
})
export class ProfileAboutComponent {
  readonly card = input.required<PersonCard>();
}
