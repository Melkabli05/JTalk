import { Component, computed, input, output } from '@angular/core';
import { Avatar } from '@openng/optimus-ui/avatar';
import { InitialsPipe } from '@shared/pipes/initials.pipe';
import { avatarColors, avatarUrl } from '@shared/utils/avatars';
import { languageOf } from '@shared/utils/languages';
import { countryNameOf, flagOf, PersonSummary } from '@shared/utils/people';

/** Someone in a list: picture, name, and one quiet line about them. Pressing them opens them; what else can be done goes beside them. */
@Component({
  selector: 'app-person-row',
  imports: [Avatar, InitialsPipe],
  template: `
    <button type="button" class="open" (click)="opened.emit(person().id)">
      @if (picture(); as image) {
        <p-avatar shape="circle" size="large" aria-hidden="true" [image]="image" />
      } @else {
        <p-avatar
          shape="circle"
          size="large"
          aria-hidden="true"
          [label]="person().name | initials"
          [style]="colors()"
        />
      }
      <span class="text">
        <strong class="name">{{ person().name }}</strong>
        <span class="meta">
          @if (person().username) {
            <span>&#64;{{ person().username }}</span>
          }
          @if (origin(); as place) {
            <span>
              <span aria-hidden="true">{{ place.flag }}</span>
              {{ place.name }}
            </span>
          }
          <span>
            <span aria-hidden="true">{{ native().flag }}</span>
            Speaks {{ native().name }}
          </span>
        </span>
      </span>
    </button>
    <div class="action"><ng-content /></div>
  `,
  styleUrl: './person-row.component.scss',
})
export class PersonRowComponent {
  readonly person = input.required<PersonSummary>();

  readonly opened = output<string>();

  protected readonly picture = computed(() => avatarUrl(this.person().avatar));
  protected readonly colors = computed(() => avatarColors(this.person().id));
  protected readonly native = computed(() => languageOf(this.person().nativeLanguage));
  protected readonly origin = computed(() => {
    const code = this.person().countryCode ?? '';
    return code === '' ? null : { flag: flagOf(code), name: countryNameOf(code) };
  });
}
