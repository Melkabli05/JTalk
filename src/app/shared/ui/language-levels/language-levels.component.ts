import { Component, computed, input } from '@angular/core';
import { ProgressBar } from '@openng/optimus-ui/progressbar';
import { Tag } from '@openng/optimus-ui/tag';
import { languageOf } from '@shared/utils/languages';
import { type LearningLanguage, PROFICIENCY_LABELS, proficiencyShare } from '@shared/utils/people';

@Component({
  selector: 'app-language-levels',
  imports: [ProgressBar, Tag],
  template: `
    @if (speaks().length > 0) {
      <section class="group" aria-labelledby="speaks-heading">
        <h3 id="speaks-heading">Speaks</h3>
        <ul class="chips">
          @for (language of speaks(); track language.code) {
            <li>
              <p-tag severity="secondary" [rounded]="true">
                <span aria-hidden="true">{{ language.flag }}</span>
                {{ language.name }}
              </p-tag>
            </li>
          }
        </ul>
      </section>
    }
    @if (learned().length > 0) {
      <section class="group" aria-labelledby="learning-heading">
        <h3 id="learning-heading">Learning</h3>
        <ul class="levels">
          @for (entry of learned(); track entry.language.code) {
            <li>
              <span class="name">
                <span aria-hidden="true">{{ entry.language.flag }}</span>
                {{ entry.language.name }}
              </span>
              @if (entry.label; as label) {
                <span class="level">{{ label }}</span>
                <p-progressbar aria-hidden="true" [value]="entry.share" [showValue]="false" />
              }
            </li>
          }
        </ul>
      </section>
    }
  `,
  styleUrl: './language-levels.component.scss',
})
export class LanguageLevelsComponent {
  readonly native = input<readonly string[]>([]);
  readonly learning = input<readonly LearningLanguage[]>([]);

  protected readonly speaks = computed(() => this.native().map(languageOf));
  protected readonly learned = computed(() =>
    this.learning().map((entry) => ({
      language: languageOf(entry.code),
      label: entry.level === null ? null : PROFICIENCY_LABELS[entry.level],
      share: entry.level === null ? 0 : proficiencyShare(entry.level),
    })),
  );
}
