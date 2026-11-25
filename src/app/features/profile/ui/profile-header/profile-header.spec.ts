import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { UserProfile } from '../../../../core/models/session.model';
import { ProfileHeader } from './profile-header';

describe('ProfileHeader', () => {
  const sampleProfile: UserProfile = {
    name: 'Jilali',
    username: 'jilali_dev',
    joined: 'May 2024',
    speak: 'Arabic',
    learn: 'English',
    location: 'Casablanca',
    about: 'Practising daily.',
    followers: 12,
    following: 9,
    avatar: { kind: 'own', id: 'own', bg: '#16121F', label: 'Your own picture' },
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
    const spy = vi.fn();
    fixture.componentInstance.editProfile.subscribe(spy);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#profileName')?.textContent).toContain('Jilali');
    expect(fixture.nativeElement.querySelector('#profileHandle')?.textContent).toContain('@jilali_dev');

    const btn: HTMLButtonElement | null = fixture.nativeElement.querySelector('button');
    btn?.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
