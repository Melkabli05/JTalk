import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import type { CanDeactivateFn } from '@angular/router';
import { map, type Observable } from 'rxjs';
import { UnsavedChangesDialog } from '../ui/unsaved-changes-dialog/unsaved-changes-dialog';

export interface HasUnsavedProfileChanges {
  hasUnsavedChanges(): boolean;
}

export const unsavedProfileGuard: CanDeactivateFn<HasUnsavedProfileChanges> = (
  component,
): boolean | Observable<boolean> => {
  if (!component?.hasUnsavedChanges()) {
    return true;
  }
  const dialog = inject(MatDialog);
  const ref = dialog.open<UnsavedChangesDialog, void, boolean>(UnsavedChangesDialog, {
    width: '400px',
    maxWidth: 'calc(100vw - 24px)',
  });
  return ref.afterClosed().pipe(map((leave) => leave === true));
};
