import { Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectButton } from '@openng/optimus-ui/selectbutton';
import { type Language, languageOf } from '@shared/utils/languages';

@Component({
  selector: 'app-language-filter',
  imports: [FormsModule, SelectButton],
  template: `
    <p-selectbutton
      optionLabel="name"
      optionValue="code"
      [options]="options()"
      [allowEmpty]="false"
      aria-label="Filter by language"
      [ngModel]="selected()"
      (ngModelChange)="selected.set($event)"
    >
      <ng-template #item let-option>
        <span>{{ option.flag }} {{ option.name }}</span>
      </ng-template>
    </p-selectbutton>
  `,
})
export class LanguageFilterComponent {
  readonly languages = input.required<readonly string[]>();
  readonly selected = model('');

  protected readonly options = computed<Language[]>(() => [
    { code: '', flag: '', name: 'All' },
    ...this.languages().map(languageOf),
  ]);
}
