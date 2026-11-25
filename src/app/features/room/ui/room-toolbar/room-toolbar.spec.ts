import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { RoomToolbar } from './room-toolbar';

describe('RoomToolbar', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoomToolbar],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should render compact room title, metadata, and emit backToRooms', () => {
    const fixture = TestBed.createComponent(RoomToolbar);
    fixture.componentRef.setInput('roomTitle', 'Evening English Café');
    fixture.componentRef.setInput('practiseLang', 'English');
    fixture.componentRef.setInput('hostName', 'Jilali');
    fixture.componentRef.setInput('peopleCount', 11);
    const spy = vi.fn();
    fixture.componentInstance.backToRooms.subscribe(spy);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#roomTitle')?.textContent).toContain(
      'Evening English Café',
    );
    expect(fixture.nativeElement.querySelector('#peopleStat')?.textContent).toContain('11');

    const backBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      'button[aria-label="Back to rooms"]',
    );
    backBtn?.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
