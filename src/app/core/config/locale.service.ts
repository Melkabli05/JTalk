import { inject, Service } from '@angular/core';
import { I18n } from '@shared/utils/i18n/i18n.service';
import type { Locale } from '@shared/utils/i18n/locales';
import { DirectionService } from './direction.service';

@Service()
export class LocaleService {
  private readonly i18n = inject(I18n);
  private readonly direction = inject(DirectionService);

  readonly locale = this.i18n.locale;

  async switchTo(locale: Locale): Promise<void> {
    await this.i18n.use(locale);
    this.direction.set(this.i18n.direction());
  }
}
