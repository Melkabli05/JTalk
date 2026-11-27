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

  it('detects dirty state and emits saved profile when submitted', () => {
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

  it('resets form state cleanly when profile input changes via linkedSignal', () => {
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

  it('preserves a draft when follower counts arrive and blocks bio over 300 chars', () => {
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

  it('removes legacy blue info banner and cover semicircle while keeping unified language list', () => {
    const fixture = TestBed.createComponent(ProfileEditForm);
    fixture.componentRef.setInput('profile', sampleProfile);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.info-banner')).toBeNull();
    expect(host.querySelector('.live-cover')).toBeNull();
    expect(host.querySelector('.cover-semicircle')).toBeNull();
    expect(host.querySelector('app-language-list')).toBeTruthy();
    expect(host.querySelector('#avatarUpload')).toBeTruthy();
  });

  it('shows inline server username error and clears it when username is edited', () => {
    const fixture = TestBed.createComponent(ProfileEditForm);
    fixture.componentRef.setInput('profile', sampleProfile);
    fixture.componentRef.setInput('serverErrors', {
      username: 'That username is already taken.',
    });
    const clearedSpy = vi.fn();
    fixture.componentInstance.serverErrorCleared.subscribe(clearedSpy);
    fixture.detectChanges();

    expect(fixture.componentInstance.profileForm.username().invalid()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'That username is already taken.',
    );

    fixture.componentInstance.onUsernameInput();
    expect(clearedSpy).toHaveBeenCalledWith('username');
  });

  it('rejects invalid avatar file types and >5 MB files, and emits cropFileRequested for valid files', () => {
    const fixture = TestBed.createComponent(ProfileEditForm);
    fixture.componentRef.setInput('profile', sampleProfile);
    const errors: string[] = [];
    const cropFiles: File[] = [];
    const savedSpy = vi.fn();
    fixture.componentInstance.uploadError.subscribe((msg) => errors.push(msg));
    fixture.componentInstance.cropFileRequested.subscribe((file) => cropFiles.push(file));
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
    expect(cropFiles).toHaveLength(0);

    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.jpg', {
      type: 'image/jpeg',
    });
    dispatchFile(oversized);
    expect(errors.at(-1)).toBe('The picture must be at most 5 MB.');
    expect(cropFiles).toHaveLength(0);

    const validPng = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'avatar.png', {
      type: 'image/png',
    });
    dispatchFile(validPng);
    expect(cropFiles).toEqual([validPng]);

    const cropped = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    fixture.componentInstance.applyCroppedAvatar(cropped, 'data:image/jpeg;base64,AA==');
    fixture.detectChanges();
    expect(fixture.componentInstance.pendingAvatarBlob()).toBe(cropped);
    expect(fixture.componentInstance.dirty()).toBe(true);

    fixture.componentInstance.onSave();
    expect(savedSpy).toHaveBeenCalledWith(expect.objectContaining({ avatarBlob: cropped }));
  });

  it('manages onboarding learning languages locally and includes them on submit', () => {
    const fixture = TestBed.createComponent(ProfileEditForm);
    fixture.componentRef.setInput('profile', null);
    fixture.componentRef.setInput('onboarding', true);
    const savedSpy = vi.fn();
    fixture.componentInstance.saved.subscribe(savedSpy);
    fixture.detectChanges();

    const form = fixture.componentInstance;
    form.model.update((m) => ({ ...m, displayName: 'Mona', nativeLanguage: 'fr' }));
    form.upsertOnboardingLearning('ja', 'INTERMEDIATE');
    form.upsertOnboardingLearning('fr', 'FLUENT'); // matches native; ignored
    fixture.detectChanges();

    expect(form.onboardingLearning()).toEqual([
      { languageCode: 'ja', proficiencyLevel: 'INTERMEDIATE' },
    ]);

    form.onSave();
    expect(savedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          displayName: 'Mona',
          nativeLanguage: 'fr',
          learningLanguage: 'ja',
          learningLanguages: [{ languageCode: 'ja', proficiencyLevel: 'INTERMEDIATE' }],
        }),
      }),
    );
  });

  it('disables Save and Discard and shows Saving… while a profile save is in flight', () => {
    const fixture = TestBed.createComponent(ProfileEditForm);
    fixture.componentRef.setInput('profile', sampleProfile);
    fixture.componentRef.setInput('saving', true);
    fixture.componentInstance.model.update((curr) => ({ ...curr, displayName: 'Karim' }));
    fixture.detectChanges();

    const saveBtn = fixture.nativeElement.querySelector('#profileSave') as HTMLButtonElement;
    const discardBtn = fixture.nativeElement.querySelector('#profileDiscard') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
    expect(saveBtn.textContent).toContain('Saving…');
    expect(discardBtn.disabled).toBe(true);
  });
});
