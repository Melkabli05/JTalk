import { Component, input, model } from '@angular/core';
import { LocaleSwitchComponent } from '@shared/ui/locale-switch/locale-switch.component';
import type { Locale } from '@shared/utils/i18n/locales';
import { VoiceBubblesComponent } from '@shared/ui/voice-bubbles/voice-bubbles.component';
import { BrandMarkComponent } from '@shared/ui/brand-mark/brand-mark.component';
import { APP_NAME } from '../../../config/app-config';
import { TranslatePipe } from '@shared/pipes/translate.pipe';

@Component({
  selector: 'app-auth-layout',
  imports: [TranslatePipe, VoiceBubblesComponent, BrandMarkComponent, LocaleSwitchComponent],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss',
})
export class AuthLayoutComponent {
  readonly heading = input.required<string>();
  readonly lead = input<string>();
  readonly locale = model.required<Locale>();

  protected readonly appName = APP_NAME;
}
