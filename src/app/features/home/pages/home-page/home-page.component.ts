import { Component, inject, signal } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { IdentityService } from '@core/auth/identity.service';
import { APP_NAME } from '@core/config/app-config';
import { LocaleService } from '@core/config/locale.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { BrandMarkComponent } from '@shared/ui/brand-mark/brand-mark.component';
import { LocaleSwitchComponent } from '@shared/ui/locale-switch/locale-switch.component';
import { PosterBackdropComponent } from '../../ui/poster-backdrop/poster-backdrop.component';

/** "Hello" in the languages people practise here, each in its own: they take turns along the bottom. They are the point, not copy. */
const GREETINGS = [
  { text: 'Hola', lang: 'es' },
  { text: 'Hello', lang: 'en' },
  { text: 'مرحبا', lang: 'ar' },
  { text: 'こんにちは', lang: 'ja' },
  { text: 'Bonjour', lang: 'fr' },
  { text: 'Ciao', lang: 'it' },
] as const;

/**
 * One screen, like a poster: what Jtalk is, and the way in. Nothing below it. It has a look of its own and does not follow the app's
 * design system (the owner's call): gradients, glow and glass are welcome here, and nowhere else.
 */
@Component({
  selector: 'app-home-page',
  imports: [
    BrandMarkComponent,
    ButtonDirective,
    LocaleSwitchComponent,
    PosterBackdropComponent,
    TranslatePipe,
  ],
  // Always the night theme, so the controls from the component library (the language switch, Sign in) are drawn for a dark page.
  host: {
    class: 'app-dark',
    '[style.--mx]': 'x()',
    '[style.--my]': 'y()',
    '(pointermove)': 'moved($event)',
  },
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export default class HomePageComponent {
  private readonly identity = inject(IdentityService);

  protected readonly locales = inject(LocaleService);
  protected readonly appName = APP_NAME;
  protected readonly greetings = GREETINGS;
  /** Where the pointer is, from -1 (left, top) to 1 (right, bottom): the shapes lean a little towards it (only where motion is welcome). */
  protected readonly x = signal(0);
  protected readonly y = signal(0);

  protected moved(event: PointerEvent): void {
    if (event.pointerType === 'touch') {
      return; // a finger dragging is scrolling, not pointing
    }
    this.x.set((event.clientX / window.innerWidth) * 2 - 1);
    this.y.set((event.clientY / window.innerHeight) * 2 - 1);
  }

  protected signIn(mode: 'login' | 'signup'): void {
    this.identity.signIn(mode).subscribe();
  }
}
