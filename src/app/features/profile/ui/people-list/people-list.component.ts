import { NgTemplateOutlet } from '@angular/common';
import type { PersonSummary } from '@shared/utils/people';
import { Component, contentChild, input, output, TemplateRef } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Message } from '@openng/optimus-ui/message';
import { Skeleton } from '@openng/optimus-ui/skeleton';
import { PersonRowComponent } from '@shared/ui/person-row/person-row.component';

/**
 * A list of people with everything around it: placeholders while it loads, a message when it fails (with a way to try again), an
 * empty state that says what to do, and a button for more. What can be done to each person is an `<ng-template>` given by the page.
 */
@Component({
  selector: 'app-people-list',
  imports: [ButtonDirective, Message, NgTemplateOutlet, PersonRowComponent, Skeleton],
  template: `
    @if (people().length > 0) {
      <ul class="list">
        @for (person of people(); track person.id) {
          <li animate.enter="row-in">
            <app-person-row [person]="person" (opened)="opened.emit($event)">
              @if (action(); as template) {
                <ng-container *ngTemplateOutlet="template; context: { $implicit: person }" />
              }
            </app-person-row>
          </li>
        }
      </ul>
      @if (failed()) {
        <p-message severity="error" size="small">Could not load more people.</p-message>
      }
      @if (hasMore() || failed()) {
        <button
          pButton
          type="button"
          class="more"
          severity="secondary"
          [outlined]="true"
          [rounded]="true"
          [loading]="loading()"
          [label]="failed() ? 'Try again' : 'Show more'"
          (click)="more.emit()"
        ></button>
      }
    } @else if (loading()) {
      <div class="placeholders" role="status" aria-label="Finding people">
        @for (row of rows; track row) {
          <div class="placeholder">
            <p-skeleton shape="circle" size="3rem" />
            <div class="lines">
              <p-skeleton width="9rem" height="1rem" />
              <p-skeleton width="14rem" height="0.75rem" />
            </div>
          </div>
        }
      </div>
    } @else if (failed()) {
      <p-message severity="error" icon="pi pi-exclamation-triangle">
        <span class="message">
          Could not load people.
          <button
            pButton
            type="button"
            size="small"
            icon="pi pi-refresh"
            severity="danger"
            [text]="true"
            label="Try again"
            (click)="more.emit()"
          ></button>
        </span>
      </p-message>
    } @else {
      <section class="empty">
        <i [class]="icon()" aria-hidden="true"></i>
        <h2>{{ title() }}</h2>
        <p>{{ text() }}</p>
      </section>
    }
  `,
  styleUrl: './people-list.component.scss',
})
export class PeopleListComponent {
  readonly people = input.required<readonly PersonSummary[]>();
  readonly loading = input(false);
  readonly failed = input(false);
  readonly hasMore = input(false);
  /** What an empty list says, and the icon above it. */
  readonly icon = input('pi pi-users');
  readonly title = input.required<string>();
  readonly text = input.required<string>();

  /** Asks for the next page, or for the first one again after a failure. */
  readonly more = output<void>();
  readonly opened = output<string>();

  protected readonly action = contentChild<TemplateRef<{ $implicit: PersonSummary }>>(TemplateRef);
  protected readonly rows = [1, 2, 3, 4];
}
