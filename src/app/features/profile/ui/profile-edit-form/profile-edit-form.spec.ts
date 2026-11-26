import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { UserProfile } from '../../../../core/models/session.model';
import { ProfileEditForm } from './profile-edit-form';

describe('ProfileEditForm', () => {
  const sampleProfile: UserProfile = {
    name: 'Jilali',
    username: 'test_04ec54',
    joined: 'May 2024',
    speak: 'Arabic',
    learn: 'English',
    location: 'Not set',
    about: '',
    followers: 12,
    following: 8,
    avatar: { kind: 'own', id: 'own', bg: '#16121F', label: 'Your own picture' },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileEditForm],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should detect dirty state and emit saved profile when submitted', () => {
    const fixture = TestBed.createComponent(ProfileEditForm);
    fixture.componentRef.setInput('profile', sampleProfile);
    const savedSpy = vi.fn();
    fixture.componentInstance.saved.subscribe(savedSpy);
    fixture.detectChanges();

    expect(fixture.componentInstance.dirty()).toBe(false);

    fixture.componentInstance.model.update((curr) => ({ ...curr, name: 'Karim' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.dirty()).toBe(true);

    fixture.componentInstance.onSave();
    expect(savedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: expect.objectContaining({ name: 'Karim' }),
        avatarBlob: null,
      }),
    );
  });

  it('should reset form state cleanly when profile input changes via linkedSignal', () => {
    const fixture = TestBed.createComponent(ProfileEditForm);
    fixture.componentRef.setInput('profile', sampleProfile);
    fixture.detectChanges();

    fixture.componentInstance.model.update((curr) => ({ ...curr, name: 'Unsaved' }));
    expect(fixture.componentInstance.dirty()).toBe(true);

    fixture.componentRef.setInput('profile', { ...sampleProfile, name: 'Nadia' });
    fixture.detectChanges();

    expect(fixture.componentInstance.previewName()).toBe('Nadia');
    expect(fixture.componentInstance.dirty()).toBe(false);
  });
  it('preserves a draft when follower counts arrive and blocks invalid input', () => {
    const fixture = TestBed.createComponent(ProfileEditForm);
    fixture.componentRef.setInput('profile', sampleProfile);
    fixture.detectChanges();
    const form = fixture.componentInstance;

    form.model.update(value => ({ ...value, name: 'Draft' }));
    fixture.componentRef.setInput('profile', { ...sampleProfile, followers: 10 });
    fixture.detectChanges();
    expect(form.model().name).toBe('Draft');

    form.model.update(value => ({ ...value, about: 'x'.repeat(301) }));
    expect(form.canSubmit()).toBe(false);
  });

  it('omits preset avatar selection and lets users reset to default or generate a username', () => {
    const fixture = TestBed.createComponent(ProfileEditForm);
    fixture.componentRef.setInput('profile', {
      ...sampleProfile,
      avatar: { kind: 'own', id: 'own', bg: '#16121F', label: 'Your picture', imageUrl: 'https://example.com/a.jpg' },
    });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('#avatarShowAll')).toBeNull();

    host.querySelector<HTMLButtonElement>('#avatarDefaultBtn')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedAvatar().imageUrl).toBeNull();
    expect(fixture.componentInstance.dirty()).toBe(true);

    const prevUsername = fixture.componentInstance.model().username;
    host.querySelector<HTMLButtonElement>('#generateUsernameBtn')!.click();
    fixture.detectChanges();
    const generated = fixture.componentInstance.model().username;
    expect(generated).toMatch(/^[a-z0-9_.]{3,30}$/);
    expect(generated).not.toBe(prevUsername);
  });

});
