import { Component, input, model } from '@angular/core';
import { LocaleSwitchComponent } from '@shared/ui/locale-switch/locale-switch.component';
import type { Locale } from '@shared/utils/i18n/locales';
import { BauhausBlocksComponent } from '@shared/ui/bauhaus-blocks/bauhaus-blocks.component';
import { BrandMarkComponent } from '@shared/ui/brand-mark/brand-mark.component';
import { APP_NAME } from '../../../config/app-config';
import { TranslatePipe } from '@shared/pipes/translate.pipe';

/**
 * Presentational frame for the account pages (sign in, register, ...): a Bauhaus poster panel (the
 * brand, a slogan and four blocks of the primaries) beside a column holding the heading, a line of
 * explanation and whatever the page projects (a form, a confirmation, links). On a phone the panel
 * shrinks to a band across the top.
 */
@Component({
  selector: 'app-auth-layout',
  imports: [TranslatePipe, BauhausBlocksComponent, BrandMarkComponent, LocaleSwitchComponent],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss',
})
export class AuthLayoutComponent {
  readonly heading = input.required<string>();
  /** One sentence under the heading saying what this page is for. */
  readonly lead = input<string>();
  readonly locale = model.required<Locale>();

  protected readonly appName = APP_NAME;
}
