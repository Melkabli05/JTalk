import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SocialStatsResponse, UserProfileResponse } from '../../../../core/auth/auth.models';
import { ProfileEditForm } from './profile-edit-form';

describe('ProfileEditForm', () => {
  const sampleProfile: UserProfileResponse = {
    id: 'u-1',
    displayName: 'Jilali',
    username: 'test_04ec54',
    bio: null,
    avatarUrl: null,
    nativeLanguage: 'ar',
    nativeLanguages: ['ar'],
    learningLanguages: [{ languageCode: 'en', proficiencyLevel: 'BEGINNER' }],
    countryCode: null,
    createdAt: '2024-05-01T00:00:00Z',
  };

  const sampleStats: SocialStatsResponse = {
    followerCount: 12,
    followingCount: 8,
    followedByMe: false,
    followsMe: false,
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
    fixture.componentRef.setInput('stats', sampleStats);
    const savedSpy = vi.fn();
    fixture.componentInstance.saved.subscribe(savedSpy);
    fixture.detectChanges();

    expect(fixture.componentInstance.dirty()).toBe(false);

    fixture.componentInstance.model.update((curr) => ({ ...curr, displayName: 'Karim' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.dirty()).toBe(true);

    fixture.componentInstance.onSave();
    expect(savedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ displayName: 'Karim' }),
        avatarBlob: null,
      }),
    );
  });

  it('should reset form state cleanly when profile input changes via linkedSignal', () => {
    const fixture = TestBed.createComponent(ProfileEditForm);
    fixture.componentRef.setInput('profile', sampleProfile);
    fixture.detectChanges();

    fixture.componentInstance.model.update((curr) => ({ ...curr, displayName: 'Unsaved' }));
    expect(fixture.componentInstance.dirty()).toBe(true);

    fixture.componentRef.setInput('profile', { ...sampleProfile, displayName: 'Nadia' });
    fixture.detectChanges();

    expect(fixture.componentInstance.previewName()).toBe('Nadia');
    expect(fixture.componentInstance.dirty()).toBe(false);
  });

  it('preserves a draft when follower counts arrive and blocks invalid input', () => {
    const fixture = TestBed.createComponent(ProfileEditForm);
    fixture.componentRef.setInput('profile', sampleProfile);
    fixture.componentRef.setInput('stats', sampleStats);
    fixture.detectChanges();
    const form = fixture.componentInstance;

    form.model.update((value) => ({ ...value, displayName: 'Draft' }));
    fixture.componentRef.setInput('stats', { ...sampleStats, followerCount: 10 });
    fixture.detectChanges();
    expect(form.model().displayName).toBe('Draft');

    form.model.update((value) => ({ ...value, bio: 'x'.repeat(301) }));
    expect(form.canSubmit()).toBe(false);
  });

  it('omits preset avatar selection and client-side username generation', () => {
    const fixture = TestBed.createComponent(ProfileEditForm);
    fixture.componentRef.setInput('profile', sampleProfile);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('#avatarShowAll')).toBeNull();
    expect(host.querySelector('#avatarDefaultBtn')).toBeNull();
    expect(host.querySelector('#generateUsernameBtn')).toBeNull();
    expect(host.querySelector('#avatarUpload')).toBeTruthy();
  });

  it('blocks saving when the learning language matches the native spoken language', () => {
    const fixture = TestBed.createComponent(ProfileEditForm);
    fixture.componentRef.setInput('profile', sampleProfile);
    fixture.detectChanges();
    const form = fixture.componentInstance;

    form.model.update((value) => ({ ...value, learningLanguage: value.nativeLanguage }));
    fixture.detectChanges();
    expect(form.profileForm.learningLanguage().invalid()).toBe(true);
    expect(form.canSubmit()).toBe(false);

    form.model.update((value) => ({ ...value, learningLanguage: '' }));
    fixture.detectChanges();
    expect(form.profileForm.learningLanguage().invalid()).toBe(false);
    expect(form.canSubmit()).toBe(true);
  });

  it('passes valid JPEG/PNG files directly to server resizing and rejects unsupported types or >5 MB', () => {
    const fixture = TestBed.createComponent(ProfileEditForm);
    fixture.componentRef.setInput('profile', sampleProfile);
    const errors: string[] = [];
    const savedSpy = vi.fn();
    fixture.componentInstance.uploadError.subscribe((msg) => errors.push(msg));
    fixture.componentInstance.saved.subscribe(savedSpy);
    fixture.detectChanges();

    const dispatchFile = (file: File): void => {
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', { value: [file] });
      const changeEvent = new Event('change');
      Object.defineProperty(changeEvent, 'target', { value: input });
      fixture.componentInstance.onFileSelected(changeEvent);
    };

    dispatchFile(new File(['webp-bytes'], 'photo.webp', { type: 'image/webp' }));
    expect(errors).toEqual(['Please select a JPEG or PNG image.']);
    expect(fixture.componentInstance.pendingAvatarBlob()).toBeNull();

    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.jpg', {
      type: 'image/jpeg',
    });
    dispatchFile(oversized);
    expect(errors.at(-1)).toBe('The picture must be at most 5 MB.');
    expect(fixture.componentInstance.pendingAvatarBlob()).toBeNull();

    const validPng = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'avatar.png', {
      type: 'image/png',
    });
    dispatchFile(validPng);
    fixture.detectChanges();
    expect(fixture.componentInstance.pendingAvatarBlob()).toBe(validPng);
    expect(fixture.componentInstance.dirty()).toBe(true);

    fixture.componentInstance.onSave();
    expect(savedSpy).toHaveBeenCalledWith(expect.objectContaining({ avatarBlob: validPng }));
  });
});
