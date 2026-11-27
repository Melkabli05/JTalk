import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { vi } from 'vitest';
import type { HostProfileDialogData } from '../../models/live-room.model';
import { HostProfileDialog } from './host-profile-dialog';

describe('HostProfileDialog', () => {
  const data: HostProfileDialogData = {
    target: { kind: 'host' },
    profile: {
      id: 'u1',
      displayName: 'Jilali',
      username: 'jilali_dev',
      createdAt: '2024-05-01T00:00:00Z',
      nativeLanguage: 'ar',
      nativeLanguages: ['ar'],
      learningLanguages: [],
      countryCode: 'MA',
      bio: null,
      avatarUrl: null,
    },
    stats: { followerCount: 15, followingCount: 10, followedByMe: false, followsMe: false },
    isYou: true,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostProfileDialog],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    }).compileComponents();
  });

  it('should render host profile preview details', () => {
    const fixture = TestBed.createComponent(HostProfileDialog);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#hostProfileName')?.textContent).toContain(
      'Jilali',
    );
    expect(fixture.nativeElement.querySelector('#hostProfileStatus')?.textContent).toContain(
      'Host · On mic · You',
    );
  });

  it('toggles follow state and updates follower count for another participant', async () => {
    const onToggleFollow = vi.fn().mockResolvedValue(true);
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [HostProfileDialog],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            ...data,
            isYou: false,
            onToggleFollow,
          },
        },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostProfileDialog);
    fixture.detectChanges();

    const followBtn = fixture.nativeElement.querySelector('#hostProfileFollowBtn') as HTMLButtonElement;
    expect(followBtn).toBeTruthy();
    expect(followBtn.textContent).toContain('Follow');

    await fixture.componentInstance.onToggleFollow();
    fixture.detectChanges();
    expect(onToggleFollow).toHaveBeenCalledWith(true);
    expect(followBtn.textContent).toContain('Following');
    expect(fixture.nativeElement.querySelector('#hostProfileFollowerCount')?.textContent).toBe('16');
  });
});
