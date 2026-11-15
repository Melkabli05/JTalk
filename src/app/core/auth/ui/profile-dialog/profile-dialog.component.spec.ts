import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { Person } from '../../identity.models';
import { ProfileDialogComponent } from './profile-dialog.component';

const MONA: Person = { id: 'm-1', name: 'Mona', nativeLanguage: 'ar', learning: 'en', avatar: '' };

describe('ProfileDialogComponent (presentational)', () => {
  let fixture: ComponentFixture<ProfileDialogComponent>;
  const text = () => (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
  const closeButton = () =>
    (fixture.nativeElement as HTMLElement).querySelector('.p-dialog-close-button');

  async function render(inputs: Record<string, unknown>) {
    fixture = TestBed.createComponent(ProfileDialogComponent);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  it('welcomes someone without a profile, and cannot be dismissed', async () => {
    await render({ visible: true });

    expect(text()).toContain('Create your profile');
    expect(text()).toContain('Tell us who you are before you join a room.');
    expect(closeButton()).toBeNull();
  });

  it('shows an existing profile for editing, and can be closed', async () => {
    await render({ visible: true, profile: MONA, cancellable: true });

    expect(text()).toContain('Your profile');
    expect(closeButton()).not.toBeNull();
  });

  it('passes on what the person saved', async () => {
    await render({ visible: true });
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    const root = fixture.nativeElement as HTMLElement;
    const name = root.querySelector('input')!;
    name.value = 'Mona';
    name.dispatchEvent(new Event('input'));
    name.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(saved).toHaveBeenCalledExactlyOnceWith({
      name: 'Mona',
      avatar: 'avatar-01',
      nativeLanguage: 'ar',
      learning: 'en',
    });
  });

  it('shows nothing while it is closed', async () => {
    await render({ visible: false });

    expect(text()).not.toContain('Create your profile');
  });
});
