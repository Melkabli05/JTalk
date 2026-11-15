import { DOCUMENT, effect, inject, Service, signal, computed } from '@angular/core';
import { LOCALES, savedLocale } from '@shared/utils/i18n/locales';
import { readItem, writeItem } from '@shared/utils/safe-storage';
import { STORAGE_KEYS } from './app-config';

type TextDirection = 'ltr' | 'rtl';

const isDirection = (value: string | null): value is TextDirection =>
  value === 'ltr' || value === 'rtl';

@Service()
export class DirectionService {
  private readonly document = inject(DOCUMENT);
  private readonly stored = readItem('local', STORAGE_KEYS.direction);

  readonly direction = signal<TextDirection>(
    isDirection(this.stored) ? this.stored : LOCALES[savedLocale()].dir,
  );
  readonly isRtl = computed(() => this.direction() === 'rtl');

  constructor() {
    effect(() => {
      this.document.documentElement.dir = this.direction();
    });
  }

  set(direction: TextDirection): void {
    this.direction.set(direction);
    writeItem('local', STORAGE_KEYS.direction, direction);
  }

  toggle(): void {
    this.set(this.isRtl() ? 'ltr' : 'rtl');
  }
}
