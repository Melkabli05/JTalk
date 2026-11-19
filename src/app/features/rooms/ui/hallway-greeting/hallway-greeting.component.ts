import { Component, computed, input, output } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Card } from '@openng/optimus-ui/card';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { languageOf } from '@shared/utils/languages';
import type { Room } from '../../models/room.model';
import { GREETINGS, partOfDay } from '../../utils/greeting';

@Component({
  selector: 'app-hallway-greeting',
  imports: [ButtonDirective, Card, TranslatePipe],
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

  protected readonly greeting = computed(
    () => GREETINGS[partOfDay(this.hour())][this.name() ? 1 : 0],
  );
  protected readonly language = computed(() =>
    this.learning() ? languageOf(this.learning()) : null,
  );
  protected readonly practising = computed(
    () => this.rooms().filter((room) => room.targetLanguage === this.learning()).length,
  );

  protected readonly night = computed(() => this.hour() < 6 || this.hour() >= 20);
  // One sky for every two hours; the veil keeps the words readable over it.
  protected readonly sky = computed(() => {
    const veil = this.night() ? 'rgb(8 12 30 / 40%)' : 'rgb(255 255 255 / 60%)';
    return `linear-gradient(90deg, ${veil}, transparent 72%), url(banners/sky-${Math.floor(this.hour() / 2)}.svg) center / cover`;
  });
}
