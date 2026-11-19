import { NgOptimizedImage } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Card } from '@openng/optimus-ui/card';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { languageOf } from '@shared/utils/languages';
import type { Room } from '../../models/room.model';
import { GREETINGS, partOfDay } from '../../utils/greeting';
import { hintFor, type Learner } from '../../utils/hallway-hint';

/**
 * The banner over the hallway, simple and small-screen first: a greeting that follows the person's time of day, one line that follows the rooms that are open
 * (how many are practising what the person learns, or that they could be the first), the way to start a room, and an illustration at
 * its side. It reads the list and says that starting was asked for; the hallway decides what that does.
 */
@Component({
  selector: 'app-hallway-greeting',
  imports: [ButtonDirective, Card, NgOptimizedImage, TranslatePipe],
  templateUrl: './hallway-greeting.component.html',
  styleUrl: './hallway-greeting.component.scss',
})
export class HallwayGreetingComponent {
  /** The person's first name, once it is known. */
  readonly name = input('');
  /** The open rooms that are shown. */
  readonly rooms = input.required<readonly Room[]>();
  readonly me = input<Learner | null>(null);
  /** The hour on the person's own clock (0 to 23), which the greeting follows. */
  readonly hour = input.required<number>();

  readonly start = output<void>();

  protected readonly greeting = computed(
    () => GREETINGS[partOfDay(this.hour())][this.name() === '' ? 0 : 1],
  );
  protected readonly hint = computed(() => hintFor(this.rooms(), this.me()));
  /** The language the hint is about, with its name. */
  protected readonly language = computed(() => {
    const hint = this.hint();
    return hint.kind === 'plain' ? null : languageOf(hint.language);
  });
}
