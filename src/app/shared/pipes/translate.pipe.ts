import { inject, Pipe, PipeTransform } from '@angular/core';
import { I18n } from '../utils/i18n/i18n.service';

@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18n);

  transform(text: string | null | undefined, params?: object): string {
    return text ? this.i18n.t(text, params) : '';
  }
}
