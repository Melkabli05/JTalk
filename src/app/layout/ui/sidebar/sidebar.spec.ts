import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Sidebar } from './sidebar';

describe('Sidebar', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Sidebar],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();
  });

  it('should omit Room from navigation tabs and render Go live card by default', () => {
    const fixture = TestBed.createComponent(Sidebar);
    fixture.componentRef.setInput('collapsed', false);
    const spy = vi.fn();
    fixture.componentInstance.startRoom.subscribe(spy);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-view="room"]')).toBeNull();
    const cta: HTMLButtonElement | null = fixture.nativeElement.querySelector('.golive-cta');
    expect(cta).toBeTruthy();
    cta?.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should render in-room card when user is in a room on another view', () => {
    const fixture = TestBed.createComponent(Sidebar);
    fixture.componentRef.setInput('collapsed', false);
    fixture.componentRef.setInput('inRoom', true);
    fixture.componentRef.setInput('activeView', 'rooms');
    fixture.componentRef.setInput('activeRoomTitle', 'Spanish Café');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.inroom-card')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Spanish Café');
  });

  it('should render profile picture in bottom account button when avatarUrl is provided', () => {
    const fixture = TestBed.createComponent(Sidebar);
    fixture.componentRef.setInput('collapsed', false);
    fixture.componentRef.setInput('profileName', 'Amina');
    fixture.componentRef.setInput('avatarUrl', '/avatars/avatar-03.svg');
    fixture.detectChanges();

    const img: HTMLImageElement | null = fixture.nativeElement.querySelector('.account .avatar img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('/avatars/avatar-03.svg');
  });
});
