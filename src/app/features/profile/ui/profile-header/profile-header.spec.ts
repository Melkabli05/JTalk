import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SocialStatsResponse, UserProfileResponse } from '../../../../core/auth/auth.models';
import { ProfileHeader } from './profile-header';

describe('ProfileHeader', () => {
  const sampleProfile: UserProfileResponse = {
    id: 'u-1',
    displayName: 'Jilali',
    username: 'jilali_dev',
    bio: 'Practising daily.',
    avatarUrl: null,
    nativeLanguage: 'ar',
    nativeLanguages: ['ar'],
    learningLanguages: [{ languageCode: 'en', proficiencyLevel: 'BEGINNER' }],
    countryCode: 'MA',
    createdAt: '2024-05-01T00:00:00Z',
  };

  const sampleStats: SocialStatsResponse = {
    followerCount: 1,
    followingCount: 9,
    followedByMe: false,
    followsMe: false,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileHeader],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('renders identity, focal language pair, pluralized counts, and emits actions', () => {
    const fixture = TestBed.createComponent(ProfileHeader);
    fixture.componentRef.setInput('profile', sampleProfile);
    fixture.componentRef.setInput('stats', sampleStats);
    const editSpy = vi.fn();
    const connSpy = vi.fn();
    fixture.componentInstance.editProfile.subscribe(editSpy);
    fixture.componentInstance.openConnections.subscribe(connSpy);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('#profileName')?.textContent).toContain('Jilali');
    expect(host.querySelector('#profileHandle')?.textContent).toContain('@jilali_dev');
    expect(host.querySelector('.phead-pair')?.textContent).toContain('Arabic');
    expect(host.querySelector('.phead-pair')?.textContent).toContain('English');
    expect(host.querySelector('#followersCountBtn')?.textContent).toContain('1 follower');
    expect(host.querySelector('.phead-avatar-live')).toBeNull();

    (host.querySelector('#followersCountBtn') as HTMLButtonElement).click();
    expect(connSpy).toHaveBeenCalledWith('followers');

    (host.querySelector('#headerEditProfileBtn') as HTMLButtonElement).click();
    expect(editSpy).toHaveBeenCalledTimes(1);
  });

  it('renders live ring indicator only when isLive is true', () => {
    const fixture = TestBed.createComponent(ProfileHeader);
    fixture.componentRef.setInput('profile', sampleProfile);
    fixture.componentRef.setInput('isLive', true);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.phead-avatar-live')).toBeTruthy();
    expect(host.querySelector('.phead-live-dot')?.getAttribute('aria-label')).toContain('live room');
  });

  it('does not fabricate Speaks English when profile is null', () => {
    const fixture = TestBed.createComponent(ProfileHeader);
    fixture.componentRef.setInput('profile', null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#profileSpeakChip')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Speaks English');
  });
});
