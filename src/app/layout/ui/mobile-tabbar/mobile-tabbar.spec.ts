import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { MobileTabbar } from './mobile-tabbar';

describe('MobileTabbar', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileTabbar],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();
  });

  it('should omit Room tab, compute avatar initial, and emit startRoom when FAB is clicked', () => {
    const fixture = TestBed.createComponent(MobileTabbar);
    fixture.componentRef.setInput('profileName', 'Nadia');
    const spy = vi.fn();
    fixture.componentInstance.startRoom.subscribe(spy);
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('.mobile-tab');
    expect(tabs.length).toBe(3);
    expect(fixture.nativeElement.textContent).not.toContain('Room\n');
    expect(fixture.componentInstance.avatarInitial()).toBe('N');

    const fab: HTMLButtonElement | null = fixture.nativeElement.querySelector('.mobile-golive-fab');
    fab?.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
