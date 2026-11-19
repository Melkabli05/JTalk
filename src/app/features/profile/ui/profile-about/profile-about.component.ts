import { Component, computed, input } from '@angular/core';
import { Card } from '@openng/optimus-ui/card';
import type { PersonCard } from '@core/people/person-card.model';
import { LanguageLevelsComponent } from '@shared/ui/language-levels/language-levels.component';
import { PartnerMatchComponent } from '@shared/ui/partner-match/partner-match.component';

@Component({
  selector: 'app-profile-about',
  imports: [Card, LanguageLevelsComponent, PartnerMatchComponent],
  template: `
    @if (hasAbout()) {
      <p-card class="about">
        <h2>About</h2>
        @if (card().details.bio) {
          <p class="bio">{{ card().details.bio }}</p>
        } @else if (card().isMe) {
          <p class="empty">Add a short bio so people know what you like to talk about.</p>
        }
        <app-partner-match [match]="card().match" />
      </p-card>
    }
    @if (card().languages; as languages) {
      <p-card class="languages">
        <h2>Languages</h2>
        <app-language-levels [native]="languages.native" [learning]="languages.learning" />
      </p-card>
    }
  `,
  styles: `
    // About and Languages sit side by side when there is room, so each is read at a glance; one column on a phone.
    :host {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
      align-items: start;
      gap: 1.5rem;
    }

    h2 {
      margin: 0 0 0.75rem;
      font-size: var(--p-jtalk-type-section);
    }

    p {
      margin: 0;
    }

    .bio {
      overflow-wrap: anywhere;
      white-space: pre-line;
    }

    .empty {
      color: var(--p-text-muted-color);
    }

    app-partner-match {
      display: block;
      margin-block-start: 1rem;
    }

    app-partner-match:empty {
      display: none;
    }
  `,
})
export class ProfileAboutComponent {
  readonly card = input.required<PersonCard>();

  protected readonly hasAbout = computed(
    () => this.card().details.bio !== '' || this.card().isMe || this.card().match !== undefined,
  );
}
