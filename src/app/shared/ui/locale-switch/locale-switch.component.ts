import { Component, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectButton } from '@openng/optimus-ui/selectbutton';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LOCALE_OPTIONS, type Locale } from '../../utils/i18n/locales';

@Component({
  selector: 'app-locale-switch',
  imports: [FormsModule, SelectButton, TranslatePipe],
  template: `
    <p-selectbutton
      size="small"
      optionLabel="name"
      optionValue="code"
      [options]="options"
      [allowEmpty]="false"
      [attr.aria-label]="'Language' | t"
      [(ngModel)]="locale"
    >
      <ng-template #item let-option>
        <span [lang]="option.code">{{ option.name }}</span>
      </ng-template>
    </p-selectbutton>
  `,
})
export class LocaleSwitchComponent {
  readonly locale = model.required<Locale>();

  protected readonly options = LOCALE_OPTIONS;
}
