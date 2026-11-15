import { CdkCopyToClipboard } from '@angular/cdk/clipboard';
import { Component, computed, effect, input, signal } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { msg } from '../../utils/i18n/msg';

const COPIED_FOR_MS = 2000;

const NAMES = {
  code: { copy: msg('Copy code'), copied: msg('Code copied') },
  answer: { copy: msg('Copy answer'), copied: msg('Answer copied') },
} as const;

@Component({
  selector: 'app-copy-button',
  imports: [TranslatePipe, ButtonDirective, CdkCopyToClipboard],
  templateUrl: './copy-button.component.html',
})
export class CopyButtonComponent {
  readonly text = input.required<string>();
  readonly what = input.required<keyof typeof NAMES>();

  protected readonly copied = signal(false);
  protected readonly name = computed(() => NAMES[this.what()]);

  constructor() {
    effect((onCleanup) => {
      if (!this.copied()) {
        return;
      }
      const timer = setTimeout(() => this.copied.set(false), COPIED_FOR_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }
}
