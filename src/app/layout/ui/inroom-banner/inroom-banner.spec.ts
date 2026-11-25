import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { InRoomBanner } from './inroom-banner';

describe('InRoomBanner', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InRoomBanner],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should display room title when visible and emit backToRoom on click', () => {
    const fixture = TestBed.createComponent(InRoomBanner);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('roomTitle', 'French Bistro');
    const spy = vi.fn();
    fixture.componentInstance.backToRoom.subscribe(spy);
    fixture.detectChanges();

    const banner: HTMLElement | null = fixture.nativeElement.querySelector('#inRoomBanner');
    expect(banner?.hidden).toBe(false);
    expect(banner?.textContent).toContain('French Bistro');

    const btn: HTMLButtonElement | null = fixture.nativeElement.querySelector('.banner-back-btn');
    btn?.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
