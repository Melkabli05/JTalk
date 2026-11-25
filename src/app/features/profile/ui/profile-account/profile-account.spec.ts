import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { UserProfile } from '../../../../core/models/session.model';
import { ProfileAccount } from './profile-account';

describe('ProfileAccount', () => {
  const sampleProfile: UserProfile = {
    name: 'Jilali',
    username: 'jilali_dev',
    joined: 'May 2024',
    speak: 'Arabic',
    learn: 'English',
    location: 'Casablanca',
    about: '',
    followers: 4,
    following: 2,
    avatar: { kind: 'own', id: 'own', bg: '#16121F', label: 'Your own picture' },
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
