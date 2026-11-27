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
    followerCount: 12,
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

  it('should render profile identity and emit editProfile on click', () => {
    const fixture = TestBed.createComponent(ProfileHeader);
    fixture.componentRef.setInput('profile', sampleProfile);
    fixture.componentRef.setInput('stats', sampleStats);
    const spy = vi.fn();
    fixture.componentInstance.editProfile.subscribe(spy);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#profileName')?.textContent).toContain('Jilali');
    expect(fixture.nativeElement.querySelector('#profileHandle')?.textContent).toContain(
      '@jilali_dev',
    );

    const btn: HTMLButtonElement | null = fixture.nativeElement.querySelector('button');
    btn?.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
