import { Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectButton } from '@openng/optimus-ui/selectbutton';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { msg } from '@shared/utils/i18n/msg';
import { type Language, languageOf } from '@shared/utils/languages';

/** Pick one of the languages that have rooms, or all of them (the empty code). */
@Component({
  selector: 'app-language-filter',
  imports: [FormsModule, SelectButton, TranslatePipe],
  template: `
    <p-selectbutton
      optionLabel="name"
      optionValue="code"
      [options]="options()"
      [allowEmpty]="false"
      [attr.aria-label]="'Filter by language' | t"
      [ngModel]="selected()"
      (ngModelChange)="selected.set($event)"
    >
      <ng-template #item let-option>
        <span>{{ option.flag }} {{ option.name | t }}</span>
      </ng-template>
    </p-selectbutton>
  `,
})
export class LanguageFilterComponent {
  readonly languages = input.required<readonly string[]>();
  readonly selected = model('');

  protected readonly options = computed<Language[]>(() => [
    { code: '', flag: '', name: msg('All') },
    ...this.languages().map(languageOf),
  ]);
}
