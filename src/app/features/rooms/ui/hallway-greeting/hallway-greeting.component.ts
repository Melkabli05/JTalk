import { Component, computed, input, model, output } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Card } from '@openng/optimus-ui/card';
import { Tag } from '@openng/optimus-ui/tag';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { msg } from '@shared/utils/i18n/msg';
import { languageOf } from '@shared/utils/languages';
import type { Room } from '../../models/room.model';
import { GREETINGS, partOfDay } from '../../utils/greeting';
import { type Learner, type Suggestion, suggest } from '../../utils/suggestions';
import { LanguageFilterComponent } from '../language-filter/language-filter.component';

/** What a suggestion looks like: the words (with what goes into them), and an icon. */
interface Item {
  readonly key: string;
  readonly words: string;
  readonly params: object;
  readonly icon: string;
  readonly suggestion: Suggestion;
}

/**
 * The banner over the hallway: a greeting by the hour, two quiet counts, a few suggestions worked out from the rooms that are open and
 * from what the person speaks and learns (a room made for them, one with a stage seat free, the busiest, or being the first in their
 * language), and the language filter. It reads the list and says what was chosen; the hallway decides what that does.
 */
@Component({
  selector: 'app-hallway-greeting',
  imports: [ButtonDirective, Card, LanguageFilterComponent, Tag, TranslatePipe],
  templateUrl: './hallway-greeting.component.html',
  styleUrl: './hallway-greeting.component.scss',
})
export class HallwayGreetingComponent {
  /** The person's first name, once it is known. */
  readonly name = input('');
  /** The open rooms that are shown (the language filter has already narrowed them). */
  readonly rooms = input.required<readonly Room[]>();
  readonly me = input<Learner | null>(null);
  /** The languages the filter offers, and the one chosen ('' is all). */
  readonly languages = input<readonly string[]>([]);
  readonly filter = model('');

  readonly join = output<Room>();
  readonly start = output<void>();

  protected readonly greeting = computed(
    () => GREETINGS[partOfDay(new Date().getHours())][this.name() === '' ? 0 : 1],
  );
  protected readonly people = computed(() =>
    this.rooms().reduce((sum, room) => sum + room.participantCount, 0),
  );

  protected readonly items = computed<readonly Item[]>(() =>
    suggest(this.rooms(), this.me()).map((suggestion): Item => {
      switch (suggestion.kind) {
        case 'match':
          return this.item(suggestion, msg('For you: {title}'), 'pi pi-star', {
            title: suggestion.room.title,
          });
        case 'seats':
          return this.item(suggestion, msg('Take the stage in {title}'), 'pi pi-microphone', {
            title: suggestion.room.title,
          });
        case 'busiest':
          return this.item(suggestion, msg('Busiest now: {title}'), 'pi pi-users', {
            title: suggestion.room.title,
          });
        case 'start':
          return this.item(suggestion, msg('Start a {language} room'), 'pi pi-plus', {
            language: languageOf(suggestion.language).name,
          });
      }
    }),
  );

  protected choose(item: Item): void {
    if ('room' in item.suggestion) {
      this.join.emit(item.suggestion.room);
    } else {
      this.start.emit();
    }
  }

  private item(suggestion: Suggestion, words: string, icon: string, params: object): Item {
    return {
      key: 'room' in suggestion ? `${suggestion.kind}:${suggestion.room.id}` : suggestion.kind,
      words,
      params,
      icon,
      suggestion,
    };
  }
}
