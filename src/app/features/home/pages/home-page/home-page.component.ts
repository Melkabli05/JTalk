import { Component, inject } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { IdentityService } from '@core/auth/identity.service';
import { APP_NAME } from '@core/config/app-config';
import { LocaleService } from '@core/config/locale.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { BrandMarkComponent } from '@shared/ui/brand-mark/brand-mark.component';
import { LocaleSwitchComponent } from '@shared/ui/locale-switch/locale-switch.component';

/** "Hello" in the languages people practise here, each in its own: they take turns under the heading. They are the point, not copy. */
const GREETINGS = [
  { text: 'Hola', lang: 'es' },
  { text: 'Hello', lang: 'en' },
  { text: 'مرحبا', lang: 'ar' },
  { text: 'こんにちは', lang: 'ja' },
  { text: 'Bonjour', lang: 'fr' },
  { text: 'Ciao', lang: 'it' },
] as const;

/** One screen, like a poster: what Jtalk is, and the way in. Nothing below it. */
@Component({
  selector: 'app-home-page',
  imports: [BrandMarkComponent, ButtonDirective, LocaleSwitchComponent, TranslatePipe],
  // The home page is always in the night theme, a poster whatever the visitor's own: the dark tokens apply within it.
  host: { class: 'app-dark' },
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export default class HomePageComponent {
  private readonly identity = inject(IdentityService);

  protected readonly locales = inject(LocaleService);
  protected readonly appName = APP_NAME;
  protected readonly greetings = GREETINGS;

  protected signIn(mode: 'login' | 'signup'): void {
    this.identity.signIn(mode).subscribe();
  }
}
