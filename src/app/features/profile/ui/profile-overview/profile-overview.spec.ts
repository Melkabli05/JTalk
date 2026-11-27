import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { UserProfileResponse } from '../../../../core/auth/auth.models';
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

  it('shows an inline bio prompt for the owner when blank and emits addBio on click', () => {
    const fixture = TestBed.createComponent(ProfileOverview);
    const addBioSpy = vi.fn();
    fixture.componentRef.setInput('profile', baseProfile);
    fixture.componentRef.setInput('isOwner', true);
    fixture.componentInstance.addBio.subscribe(addBioSpy);
    fixture.detectChanges();

    const promptBtn = fixture.nativeElement.querySelector('#addBioPromptBtn') as HTMLButtonElement;
    expect(promptBtn).toBeTruthy();
    promptBtn.click();
    expect(addBioSpy).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('profile', { ...baseProfile, bio: 'Practising Japanese daily.' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#addBioPromptBtn')).toBeNull();
    expect(fixture.nativeElement.querySelector('#aboutBioText')?.textContent).toContain(
      'Practising Japanese daily.',
    );
  });

  it('renders ordered native and learning languages with level meters only for learning languages', () => {
    const fixture = TestBed.createComponent(ProfileOverview);
    fixture.componentRef.setInput('profile', {
      ...baseProfile,
      nativeLanguages: ['ar', 'fr'],
      learningLanguages: [{ languageCode: 'ja', proficiencyLevel: 'ADVANCED' }],
    });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Arabic');
    expect(host.textContent).toContain('العربية');
    expect(host.textContent).toContain('French');
    expect(host.textContent).toContain('Japanese');
    expect(host.textContent).toContain('日本語');
    const meters = host.querySelectorAll('app-level-meter');
    expect(meters.length).toBe(1);
    expect(meters[0]?.textContent).toContain('Advanced');

    fixture.componentRef.setInput('profile', { ...baseProfile, learningLanguages: [] });
    fixture.detectChanges();
    expect(host.querySelectorAll('app-level-meter').length).toBe(0);
  });
});
