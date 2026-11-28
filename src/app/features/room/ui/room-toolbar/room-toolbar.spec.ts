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

  it('should render raised hand requests with profile preview and emit profile, approve, and dismiss events', () => {
    const fixture = TestBed.createComponent(RoomToolbar);
    fixture.componentRef.setInput('roomTitle', 'Evening English Café');
    fixture.componentRef.setInput('practiseLang', 'English');
    fixture.componentRef.setInput('hostName', 'Jilali');
    fixture.componentRef.setInput('peopleCount', 11);
    fixture.componentRef.setInput('canModerate', true);
    fixture.componentRef.setInput('pendingRequests', [
      {
        id: 'u-2',
        name: 'Amina',
        initial: 'A',
        avatarUrl: 'https://cdn.example.com/amina.png',
        chipClass: 'avatar-chip-green',
        position: 1,
      },
    ]);
    const viewSpy = vi.fn();
    const approveSpy = vi.fn();
    const dismissSpy = vi.fn();
    fixture.componentInstance.viewRequestProfile.subscribe(viewSpy);
    fixture.componentInstance.approveRequest.subscribe(approveSpy);
    fixture.componentInstance.dismissRequest.subscribe(dismissSpy);
    fixture.detectChanges();

    const queueBtn = fixture.nativeElement.querySelector('#modQueueBtn') as HTMLButtonElement;
    expect(queueBtn.classList.contains('is-has-requests')).toBe(true);
    expect(fixture.nativeElement.querySelector('#pendingReqBadge')?.textContent?.trim()).toBe('1');

    queueBtn.click();
    fixture.detectChanges();

    const profileBtn = document.querySelector('.mod-req-user') as HTMLButtonElement | null;
    expect(profileBtn?.textContent).toContain('Amina');
    expect(profileBtn?.textContent).toContain('#1 in queue · Profile');
    expect(profileBtn?.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.example.com/amina.png',
    );

    const approveBtn = document.querySelector('.mod-req-btn.is-approve') as HTMLButtonElement;
    const dismissBtn = document.querySelector('.mod-req-btn.is-reject') as HTMLButtonElement;
    approveBtn.click();
    dismissBtn.click();
    profileBtn?.click();

    expect(approveSpy).toHaveBeenCalledWith('u-2');
    expect(dismissSpy).toHaveBeenCalledWith('u-2');
    expect(viewSpy).toHaveBeenCalledWith('u-2');
  });
});

