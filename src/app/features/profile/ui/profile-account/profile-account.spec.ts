import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { UserProfileResponse } from '../../../../core/auth/auth.models';
import { ProfileAccount } from './profile-account';

describe('ProfileAccount', () => {
  const sampleProfile: UserProfileResponse = {
    id: 'u-1',
    displayName: 'Jilali',
    username: 'jilali_dev',
    bio: null,
    avatarUrl: null,
    nativeLanguage: 'ar',
    nativeLanguages: ['ar'],
    learningLanguages: [{ languageCode: 'en', proficiencyLevel: 'BEGINNER' }],
    countryCode: 'MA',
    createdAt: '2024-05-01T00:00:00Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileAccount],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should emit deleteClicked when Delete your account button is pressed', () => {
    const fixture = TestBed.createComponent(ProfileAccount);
    fixture.componentRef.setInput('profile', sampleProfile);
    const spy = vi.fn();
    fixture.componentInstance.deleteClicked.subscribe(spy);
    fixture.detectChanges();

    const btn: HTMLButtonElement | null = fixture.nativeElement.querySelector('#deleteAccountBtn');
    btn?.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
