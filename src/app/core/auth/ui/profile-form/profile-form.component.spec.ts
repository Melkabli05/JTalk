import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { Mock } from 'vitest';
import { formHarness } from '@shared/utils/form-harness';
import type { Person, ProfileDraft } from '../../identity.models';
import { ProfileFormComponent } from './profile-form.component';

const MONA: Person = { id: 'm-1', name: 'Mona', nativeLanguage: 'fr', learning: 'de', avatar: '' };

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
    await render({ profile: MONA, cancellable: true });

    expect(field('Your name').value).toBe('Mona');
    expect(choices()[0]).toContain('French');
    expect(choices()[1]).toContain('German');
    expect(buttons()).toEqual(['Cancel', 'Save']);
  });

  it('can be cancelled only when it may be', async () => {
    await render({ profile: MONA, cancellable: true });
    const cancelled = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelled);

    [...root().querySelectorAll('button')].find((b) => b.textContent?.includes('Cancel'))!.click();

    expect(cancelled).toHaveBeenCalledOnce();
  });
});
