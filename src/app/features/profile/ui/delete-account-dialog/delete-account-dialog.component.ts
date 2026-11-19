import { Component, computed, input, model, output, signal } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { Dialog } from '@openng/optimus-ui/dialog';
import { InputText } from '@openng/optimus-ui/inputtext';
import { Message } from '@openng/optimus-ui/message';

let nextId = 0;

/**
 * The last question before an account is deleted for good. Nothing is deleted until the person has typed their own handle, so a stray
 * press cannot do it; the dialog only asks, the page does the deleting.
 */
@Component({
  selector: 'app-delete-account-dialog',
  imports: [ButtonDirective, Dialog, InputText, Message],
  template: `
    <p-dialog
      styleClass="delete-account"
      [modal]="true"
      [dismissableMask]="!busy()"
      [closable]="!busy()"
      header="Delete your account"
      [style]="{ width: '28rem', maxWidth: '95vw' }"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
      (onHide)="typed.set('')"
    >
      <p class="what">
        This permanently deletes your profile, your languages, who you follow and who follows you,
        and the people you blocked. It cannot be undone.
      </p>
      <p class="again">
        A room you host goes to the person who has been on its stage the longest, or closes if
        nobody else is on it. The rooms you hosted are erased.
      </p>
      <p class="again">You can sign up again any time, with a fresh profile.</p>

      <label class="ask" [for]="fieldId"> Type {{ word() }} to confirm </label>
      <input
        pInputText
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        [id]="fieldId"
        [value]="typed()"
        [disabled]="busy()"
        (input)="typed.set($any($event.target).value)"
      />

      @if (error(); as failure) {
        <p-message class="failure" severity="error" size="small" role="alert">{{
          failure
        }}</p-message>
      }

      <div class="actions">
        <button
          pButton
          type="button"
          severity="secondary"
          [text]="true"
          [rounded]="true"
          [disabled]="busy()"
          label="Cancel"
          (click)="visible.set(false)"
        ></button>
        <button
          pButton
          type="button"
          severity="danger"
          icon="pi pi-trash"
          [rounded]="true"
          [loading]="busy()"
          [disabled]="!matches() || busy()"
          label="Delete my account"
          (click)="confirmed.emit()"
        ></button>
      </div>
    </p-dialog>
  `,
  styles: `
    p {
      margin: 0 0 0.75rem;
    }

    .again {
      color: var(--p-text-muted-color);
    }

    .ask {
      display: block;
      margin-block: 0.5rem 0.375rem;
      font-weight: 600;
    }

    input {
      inline-size: 100%;
    }

    .failure {
      display: block;
      margin-block-start: 0.75rem;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-block-start: 1.25rem;
    }
  `,
})
export class DeleteAccountDialogComponent {
  readonly visible = model(false);
  /** What must be typed: their handle, or their name when it is not known. */
  readonly word = input.required<string>();
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly confirmed = output<void>();

  protected readonly fieldId = `app-delete-account-${nextId++}`;
  protected readonly typed = signal('');
  protected readonly matches = computed(
    () => this.typed().trim().toLowerCase() === this.word().trim().toLowerCase(),
  );
}
