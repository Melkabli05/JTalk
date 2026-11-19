import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { Mock } from 'vitest';
import { AvatarPickerComponent } from '@shared/ui/avatar-picker/avatar-picker.component';
import { formHarness } from '@shared/utils/form-harness';
import type { Person, ProfileDraft } from '../../identity.models';
import { ProfileFormComponent } from './profile-form.component';

const MONA: Person = {
  id: 'm-1',
  name: 'Mona',
  username: 'mona.k',
  nativeLanguage: 'fr',
  learning: 'de',
  avatar: '',
};
const UPLOADED = '/api/v1/users/6f1c2b9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f/avatar/1763560000000';

describe('ProfileFormComponent (presentational)', () => {
  let fixture: ComponentFixture<ProfileFormComponent>;
  let saved: Mock<(draft: ProfileDraft) => void>;
  const { root, field, type, submit } = formHarness(() => fixture);
  const buttons = () => [...root().querySelectorAll('button')].map((b) => b.textContent?.trim());
  const choices = () =>
    [...root().querySelectorAll('app-select-field')].map((s) =>
      s.textContent?.replace(/\s+/g, ' ').trim(),
    );

  async function render(inputs: Record<string, unknown> = {}) {
    fixture = TestBed.createComponent(ProfileFormComponent);
    saved = vi.fn<(draft: ProfileDraft) => void>();
    fixture.componentInstance.saved.subscribe(saved);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  it('starts empty, speaking Arabic and learning English', async () => {
    await render();

    expect(field('Your name').value).toBe('');
    expect(choices()[0]).toContain('Arabic');
    expect(choices()[1]).toContain('English');
    expect(buttons()).toEqual(['Continue']);
  });

  it('emits the profile with a trimmed name', async () => {
    await render();
    await type('Your name', '  Mona  ');
    await submit();

    expect(saved).toHaveBeenCalledExactlyOnceWith({
      name: 'Mona',
      avatar: 'avatar-01',
      nativeLanguage: 'ar',
      learning: 'en',
      bio: '',
      countryCode: '',
    });
  });

  it('refuses a missing name, shows why, and focuses it', async () => {
    await render();
    await submit();

    expect(root().textContent).toContain('Enter your name.');
    expect(document.activeElement).toBe(field('Your name'));
    expect(saved).not.toHaveBeenCalled();
  });

  it('refuses a name that is too long', async () => {
    await render();
    await type('Your name', 'x'.repeat(41));
    await submit();

    expect(root().textContent).toContain('Use at most 40 characters.');
    expect(saved).not.toHaveBeenCalled();
  });

  it('starts with the first picture chosen, and emits the one picked', async () => {
    await render();
    const radios = () => [
      ...root().querySelectorAll<HTMLInputElement>('app-avatar-picker input[type="radio"]'),
    ];
    expect(radios().findIndex((r) => r.checked)).toBe(0);

    radios()[3].click();
    await type('Your name', 'Mona');
    await submit();

    expect(saved).toHaveBeenCalledExactlyOnceWith({
      name: 'Mona',
      avatar: 'avatar-04',
      nativeLanguage: 'ar',
      learning: 'en',
      bio: '',
      countryCode: '',
    });
  });

  it('shows the chosen picture checked in the picker, which is the only preview', async () => {
    await render();
    const checked = () =>
      root().querySelector<HTMLInputElement>('app-avatar-picker input[type="radio"]:checked')
        ?.value;
    expect(checked()).toBe('avatar-01');
    expect(root().querySelector('.preview')).toBeNull();

    root().querySelectorAll<HTMLInputElement>('app-avatar-picker input[type="radio"]')[2].click();
    await fixture.whenStable();

    expect(checked()).toBe('avatar-03');
  });

  it('keeps the picture of someone editing their profile, and falls back when theirs is gone', async () => {
    await render({ profile: { ...MONA, avatar: 'avatar-09' } });
    expect(root().querySelector<HTMLInputElement>('app-avatar-picker input:checked')?.value).toBe(
      'avatar-09',
    );

    await render({ profile: { ...MONA, avatar: 'avatar-99' } });
    expect(root().querySelector<HTMLInputElement>('app-avatar-picker input:checked')?.value).toBe(
      'avatar-01',
    );
  });

  it('edits an existing profile: it starts from it and says Save', async () => {
    await render({ profile: MONA });

    expect(field('Your name').value).toBe('Mona');
    expect(choices()[0]).toContain('French');
    expect(choices()[1]).toContain('German');
    expect(buttons()).toEqual(['Save']);
  });

  describe('bio and country', () => {
    const about = () => root().querySelector<HTMLTextAreaElement>('app-textarea-field textarea')!;
    const countryChoice = () =>
      root().querySelectorAll('app-select-field')[2]?.textContent?.replace(/\s+/g, ' ').trim();

    it('starts with what is already saved, and says the country is not set when it is not', async () => {
      await render();
      expect(about().value).toBe('');
      expect(countryChoice()).toContain('Not set');

      await render({ profile: { ...MONA, bio: 'Tea and Spanish', countryCode: 'MA' } });
      expect(about().value).toBe('Tea and Spanish');
      expect(countryChoice()).toContain('Morocco');
    });

    it('emits the bio trimmed and the country chosen', async () => {
      await render({ profile: { ...MONA, countryCode: 'ES' } });
      about().value = '  Hola amigos  ';
      about().dispatchEvent(new Event('input'));
      about().dispatchEvent(new Event('blur'));
      await fixture.whenStable();

      await submit();

      expect(saved).toHaveBeenCalledWith(
        expect.objectContaining({ bio: 'Hola amigos', countryCode: 'ES' }),
      );
    });

    it('refuses a bio longer than 300 characters', async () => {
      await render({ profile: MONA });
      about().value = 'x'.repeat(301);
      about().dispatchEvent(new Event('input'));
      about().dispatchEvent(new Event('blur'));
      await fixture.whenStable();

      await submit();

      expect(saved).not.toHaveBeenCalled();
      expect(root().textContent).toContain('Use at most 300 characters.');
    });
  });

  describe('the username', () => {
    it('is not asked for when the profile is made: a handle is made for them', async () => {
      await render();

      expect(root().textContent).not.toContain('Username');
      await type('Your name', 'Mona');
      await submit();
      expect('username' in saved.mock.calls[0][0]).toBe(false);
    });

    it('is edited with the profile, with its rule written beside it', async () => {
      await render({ profile: MONA });

      expect(field('Username').value).toBe('mona.k');
      expect(root().textContent).toContain('You can change it once every 30 days.');
    });

    it('is emitted trimmed and in lowercase', async () => {
      await render({ profile: MONA });
      await type('Username', '  Mona.New  ');
      await submit();

      expect(saved).toHaveBeenCalledWith(expect.objectContaining({ username: 'mona.new' }));
    });

    it.each(['ab', 'has space', 'bad!', 'x'.repeat(31)])(
      'refuses %j and says what is allowed',
      async (bad) => {
        await render({ profile: MONA });
        await type('Username', bad);
        await submit();

        expect(root().textContent).toContain('Use 3 to 30 letters, numbers, _ or .');
        expect(saved).not.toHaveBeenCalled();
      },
    );

    it('refuses an empty username', async () => {
      await render({ profile: MONA });
      await type('Username', '');
      await submit();

      expect(root().textContent).toContain('Enter a username.');
      expect(saved).not.toHaveBeenCalled();
    });
  });

  describe('a picture of their own', () => {
    const picker = () =>
      fixture.debugElement.query(By.directive(AvatarPickerComponent))
        .componentInstance as AvatarPickerComponent;
    const checked = () =>
      root().querySelector<HTMLInputElement>('app-avatar-picker input[type="radio"]:checked')
        ?.value;
    const picture = () => new Blob(['small jpeg'], { type: 'image/jpeg' });

    const revoke = vi.fn();

    beforeEach(() => {
      revoke.mockClear();
      URL.createObjectURL = vi.fn(() => 'blob:preview');
      URL.revokeObjectURL = revoke;
    });

    it('offers no picture of their own until there is one', async () => {
      await render({ profile: MONA });

      expect(root().querySelector('app-avatar-picker .own')).toBeNull();
      expect(root().querySelectorAll('app-avatar-picker input[type="radio"]')).toHaveLength(10);
    });

    it('starts with the picture they uploaded before chosen, and keeps it as it is stored', async () => {
      await render({ profile: { ...MONA, avatar: UPLOADED } });

      expect(checked()).toBe('custom');
      expect(
        root().querySelector<HTMLElement>('app-avatar-picker .own')?.style.backgroundImage,
      ).toContain(UPLOADED);
      await submit();

      const draft = saved.mock.calls[0][0];
      expect(draft.avatar).toBe(UPLOADED);
      expect('upload' in draft).toBe(false);
    });

    it('shows the picture they just chose as chosen, and sends it with the save', async () => {
      await render({ profile: MONA });
      const blob = picture();

      picker().picked.emit(blob);
      await fixture.whenStable();

      expect(checked()).toBe('custom');
      expect(
        root().querySelector<HTMLElement>('app-avatar-picker .own')?.style.backgroundImage,
      ).toContain('blob:preview');
      await submit();
      expect(saved).toHaveBeenCalledWith(expect.objectContaining({ upload: blob }));
    });

    it('works while the profile is being made, with one of ours standing in until the picture is sent', async () => {
      await render();
      const blob = picture();
      picker().picked.emit(blob);
      await type('Your name', 'Mona');
      await submit();

      expect(saved).toHaveBeenCalledWith(
        expect.objectContaining({ avatar: 'avatar-01', upload: blob }),
      );
    });

    it('sends nothing when they chose one of ours after all', async () => {
      await render({ profile: MONA });
      picker().picked.emit(picture());
      await fixture.whenStable();

      root().querySelectorAll<HTMLInputElement>('app-avatar-picker input[type="radio"]')[4].click();
      await fixture.whenStable();
      await submit();

      const draft = saved.mock.calls[0][0];
      expect(draft.avatar).toBe('avatar-05');
      expect('upload' in draft).toBe(false);
    });

    it('lets go of the preview when it is replaced and when the form goes away', async () => {
      await render({ profile: MONA });
      picker().picked.emit(picture());
      picker().picked.emit(picture());
      await fixture.whenStable();
      expect(revoke).toHaveBeenCalledTimes(1);

      fixture.destroy();

      expect(revoke).toHaveBeenCalledTimes(2);
    });

    it('forgets a waiting picture once the saved profile has the new one', async () => {
      await render({ profile: MONA });
      picker().picked.emit(picture());
      await fixture.whenStable();

      fixture.componentRef.setInput('profile', { ...MONA, avatar: UPLOADED });
      await fixture.whenStable();
      await submit();

      expect('upload' in saved.mock.calls[0][0]).toBe(false);
    });
  });
});
