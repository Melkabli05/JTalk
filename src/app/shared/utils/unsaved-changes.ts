import { CanDeactivateFn } from '@angular/router';
import { ConfirmationService } from '@openng/optimus-ui/api';
import type { I18n } from './i18n/i18n.service';

/** Implemented by a routed page that can hold edits the user has not saved. */
export interface HasUnsavedChanges {
  canLeave(): boolean | Promise<boolean>;
}

/** `canDeactivate` guard: lets the page decide (and ask) before the router leaves it. */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (page) => page.canLeave();

/**
 * Asks to discard unsaved changes with the page's `<p-confirmdialog />`. Resolves `true` only on
 * "Discard"; the Cancel button, the close button and Escape all reject, so navigation never hangs.
 */
export function confirmDiscard(confirmation: ConfirmationService, i18n: I18n): Promise<boolean> {
  return new Promise((resolve) => {
    confirmation.confirm({
      header: i18n.t('Discard changes?'),
      message: i18n.t('You have unsaved changes. If you leave now they will be lost.'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: i18n.t('Discard'),
      rejectLabel: i18n.t('Keep editing'),
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => resolve(true),
      reject: () => resolve(false),
    });
  });
}
