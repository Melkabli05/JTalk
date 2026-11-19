import { Component, computed, input, output } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Card } from '@openng/optimus-ui/card';
import { languageOf } from '@shared/utils/languages';
import type { Room } from '../../models/room.model';
import { greetingFor } from '../../utils/greeting';

@Component({
  selector: 'app-hallway-greeting',
  imports: [ButtonDirective, Card],
  templateUrl: './hallway-greeting.component.html',
  styleUrl: './hallway-greeting.component.scss',
})
export class HallwayGreetingComponent {
  readonly name = input('');
  readonly rooms = input.required<readonly Room[]>();
  /** The code of the language the person is learning, if they have one. */
  readonly learning = input('');
  /** The hour on the person's clock, 0 to 23. */
  readonly hour = input.required<number>();
  /** False while the person is in a room already: there is nothing to start. */
  readonly canStart = input(true);

  readonly start = output<void>();

  protected readonly greeting = computed(() => greetingFor(this.hour(), this.name()));
  protected readonly language = computed(() =>
    this.learning() ? languageOf(this.learning()) : null,
  );
  protected readonly practising = computed(
    () => this.rooms().filter((room) => room.targetLanguage === this.learning()).length,
  );

  /** The card is clear, so the photograph behind it shows through. */
  protected readonly clear = {
    root: { background: 'transparent', borderColor: 'transparent', shadow: 'none' },
  };
  /** The photographs of the late evening and the night are dark: the words on them are light. */
  protected readonly dark = computed(() => this.hour() < 4 || this.hour() >= 20);
  // One photograph for every two hours of the day.
  protected readonly photo = computed(() => `url(banners/sky-${Math.floor(this.hour() / 2)}.jpg)`);
}
