import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UserProfile } from '../../../../core/models/session.model';
import { ProfileOverview } from './profile-overview';

describe('ProfileOverview', () => {
  const baseProfile: UserProfile = {
    name: 'Jilali',
    username: 'jilali',
    joined: 'May 2024',
    speak: 'Arabic',
    learn: 'English',
    location: 'Not set',
    about: '',
    followers: 4,
    following: 5,
    avatar: { kind: 'own', id: 'own', bg: '#16121F', label: 'Your own picture' },
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

    fixture.componentRef.setInput('profile', { ...baseProfile, about: 'Hello world!' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#aboutBioText')?.textContent).toContain('Hello world!');
  });
});
