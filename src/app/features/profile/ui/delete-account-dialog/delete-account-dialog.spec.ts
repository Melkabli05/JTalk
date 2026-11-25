import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { vi } from 'vitest';
import { DeleteAccountDialog } from './delete-account-dialog';

describe('DeleteAccountDialog', () => {
  const closeSpy = vi.fn();

  beforeEach(async () => {
    closeSpy.mockReset();
    await TestBed.configureTestingModule({
      imports: [DeleteAccountDialog],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: { close: closeSpy } },
      ],
    }).compileComponents();
  });

  it('should only enable confirmation when DELETE is typed', () => {
    const fixture = TestBed.createComponent(DeleteAccountDialog);
    fixture.detectChanges();

    expect(fixture.componentInstance.canDelete()).toBe(false);
    fixture.componentInstance.onConfirm();
    expect(closeSpy).not.toHaveBeenCalled();

    fixture.componentInstance.confirmModel.set('DELETE');
    fixture.detectChanges();
    expect(fixture.componentInstance.canDelete()).toBe(true);

    fixture.componentInstance.onConfirm();
    expect(closeSpy).toHaveBeenCalledWith(true);
  });
});
