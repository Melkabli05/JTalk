import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { vi } from 'vitest';
import { EndRoomDialog } from './end-room-dialog';

describe('EndRoomDialog', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EndRoomDialog],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    }).compileComponents();
  });

  it('should render confirmation title and End room button', () => {
    const fixture = TestBed.createComponent(EndRoomDialog);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#endModalTitle')?.textContent).toContain(
      'End room for everyone?',
    );
    expect(fixture.nativeElement.querySelector('#confirmEndRoom')).toBeTruthy();
  });
});
