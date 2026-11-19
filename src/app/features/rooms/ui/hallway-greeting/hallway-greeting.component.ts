import { Component, computed, input, output } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Card } from '@openng/optimus-ui/card';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { languageOf } from '@shared/utils/languages';
import type { Room } from '../../models/room.model';
import { GREETINGS, partOfDay, sceneFor } from '../../utils/greeting';
import { hintFor, type Learner } from '../../utils/hallway-hint';

/**
 * The banner over the hallway, simple and small-screen first: a greeting that follows the person's time of day, one line that follows the rooms that are open
 * (how many are practising what the person learns, or that they could be the first) and the way to start a room, over a sky that
 * changes every two hours with the person's own time, like the weather outside. It reads the list and says that starting was asked for; the hallway decides what that does.
 */
@Component({
  selector: 'app-hallway-greeting',
  imports: [ButtonDirective, Card, TranslatePipe],
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
  protected readonly scene = computed(() => sceneFor(this.hour()));
  /** The sky behind the words, from a light veil on the words' side so they stay easy to read, over the picture for the hour. */
  protected readonly sky = computed(() => {
    const { slot, night } = this.scene();
    const veil = night ? 'rgba(8, 12, 30, 0.4)' : 'rgba(255, 255, 255, 0.6)';
    return {
      'background-image': `linear-gradient(90deg, ${veil} 0%, transparent 72%), url('banners/sky-${String(slot).padStart(2, '0')}.svg')`,
      'background-size': 'cover',
      'background-position': 'center',
    };
  });
  protected readonly hint = computed(() => hintFor(this.rooms(), this.me()));
  /** The language the hint is about, with its name. */
  protected readonly language = computed(() => {
    const hint = this.hint();
    return hint.kind === 'plain' ? null : languageOf(hint.language);
  });
}
