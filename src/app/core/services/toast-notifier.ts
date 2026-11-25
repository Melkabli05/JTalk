import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID, Service } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Service()
export class ToastNotifier {
  private readonly snackBar = inject(MatSnackBar);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  show(msg: string, durationMs = 2400): void {
    if (!this.isBrowser) return;
    this.snackBar.open(msg, undefined, {
      duration: durationMs,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: ['jtalk-snackbar'],
    });
  }
}
