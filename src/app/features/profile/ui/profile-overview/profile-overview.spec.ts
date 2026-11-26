import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UserProfileResponse } from '../../../../core/auth/auth.models';
import { ProfileOverview } from './profile-overview';

describe('ProfileOverview', () => {
  const baseProfile: UserProfileResponse = {
    id: 'u-1',
    displayName: 'Jilali',
    username: 'jilali',
    bio: null,
    avatarUrl: null,
    nativeLanguage: 'ar',
    nativeLanguages: ['ar'],
    learningLanguages: [{ languageCode: 'en', proficiencyLevel: 'BEGINNER' }],
    countryCode: null,
    createdAt: '2024-05-01T00:00:00Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileOverview],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should render empty state when bio is blank and show bio when provided', () => {
    const fixture = TestBed.createComponent(ProfileOverview);
    fixture.componentRef.setInput('profile', baseProfile);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#aboutEmptyText')).toBeTruthy();

    fixture.componentRef.setInput('profile', { ...baseProfile, bio: 'Hello world!' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#aboutBioText')?.textContent).toContain('Hello world!');
  });
});
