import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatChipListboxChange } from '@angular/material/chips';
import { vi } from 'vitest';
import { LanguageFilterChip } from '../../constants/rooms.constants';
import { LanguageChips } from './language-chips';

describe('LanguageChips', () => {
  const chips: LanguageFilterChip[] = [
    { value: 'all', label: 'All' },
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'French' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LanguageChips],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should render chip options and emit filterChange on selection', () => {
    const fixture = TestBed.createComponent(LanguageChips);
    fixture.componentRef.setInput('chips', chips);
    fixture.componentRef.setInput('selected', 'all');
    const spy = vi.fn();
    fixture.componentInstance.filterChange.subscribe(spy);
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('mat-chip-option');
    expect(options.length).toBe(3);

    fixture.componentInstance.onSelectionChange({ value: 'en' } as MatChipListboxChange);
    expect(spy).toHaveBeenCalledWith('en');
  });
});
