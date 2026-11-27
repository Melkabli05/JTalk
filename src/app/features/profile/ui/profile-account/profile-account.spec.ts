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

  it('renders identity with email, omits redundant Settings row, and emits deleteClicked', () => {
    const fixture = TestBed.createComponent(ProfileAccount);
    fixture.componentRef.setInput('profile', sampleProfile);
    fixture.componentRef.setInput('authEmail', 'jilali@example.com');
    const deleteSpy = vi.fn();
    fixture.componentInstance.deleteClicked.subscribe(deleteSpy);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('@jilali_dev');
    expect(host.textContent).toContain('jilali@example.com');
    expect(host.textContent).not.toContain('Settings');
    expect(host.querySelector('#installAppBtn')).toBeNull();

    const btn = host.querySelector('#deleteAccountBtn') as HTMLButtonElement;
    btn.click();
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  it('emits themePreferenceChange when choosing System, Light, or Dark', () => {
    const fixture = TestBed.createComponent(ProfileAccount);
    fixture.componentRef.setInput('profile', sampleProfile);
    fixture.componentRef.setInput('themePreference', 'system');
    const prefSpy = vi.fn();
    fixture.componentInstance.themePreferenceChange.subscribe(prefSpy);
    fixture.detectChanges();

    const darkBtn = fixture.nativeElement.querySelector('#themeDarkBtn button') as HTMLButtonElement;
    darkBtn.click();
    fixture.detectChanges();
    expect(prefSpy).toHaveBeenCalledWith('dark');
  });

  it('shows Install Jtalk app only when canInstall is true and emits signOutClicked', () => {
    const fixture = TestBed.createComponent(ProfileAccount);
    fixture.componentRef.setInput('profile', sampleProfile);
    fixture.componentRef.setInput('canInstall', true);
    const installSpy = vi.fn();
    const signOutSpy = vi.fn();
    fixture.componentInstance.installClicked.subscribe(installSpy);
    fixture.componentInstance.signOutClicked.subscribe(signOutSpy);
    fixture.detectChanges();

    const installBtn = fixture.nativeElement.querySelector('#installAppBtn') as HTMLButtonElement;
    expect(installBtn).toBeTruthy();
    installBtn.click();
    expect(installSpy).toHaveBeenCalledTimes(1);

    const signOutBtn = fixture.nativeElement.querySelector('#signOutBtn') as HTMLButtonElement;
    signOutBtn.click();
    expect(signOutSpy).toHaveBeenCalledTimes(1);
  });
});
