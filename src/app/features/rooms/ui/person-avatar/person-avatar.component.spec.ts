import { TestBed } from '@angular/core/testing';
import type { Member } from '../../models/room.model';
import { PersonAvatarComponent } from './person-avatar.component';

const ADA: Member = {
  id: 'a-1',
  name: 'Ada Lovelace',
  nativeLanguage: 'en',
  learning: 'ar',
  avatar: '',
};

describe('PersonAvatarComponent (presentational)', () => {
  async function render(member: Member) {
    const fixture = TestBed.createComponent(PersonAvatarComponent);
    fixture.componentRef.setInput('member', member);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the picture the person chose', async () => {
    const root = await render({ ...ADA, avatar: 'avatar-03' });

    expect(root.querySelector('img')?.getAttribute('src')).toBe('avatars/avatar-03.svg');
    expect(root.textContent?.trim()).toBe('');
  });

  it('shows their initials in a steady color when they have no picture, or one we do not have', async () => {
    for (const avatar of ['', 'avatar-99']) {
      const root = await render({ ...ADA, avatar });

      expect(root.querySelector('img')).toBeNull();
      expect(root.textContent?.trim()).toBe('AL');
    }
  });

  it('marks itself while the person is being heard', async () => {
    const fixture = TestBed.createComponent(PersonAvatarComponent);
    fixture.componentRef.setInput('member', ADA);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList.contains('speaking')).toBe(false);

    fixture.componentRef.setInput('speaking', true);
    await fixture.whenStable();
    expect(host.classList.contains('speaking')).toBe(true);
  });

  it('is decorative: the name always sits beside it', async () => {
    const root = await render({ ...ADA, avatar: 'avatar-03' });

    expect(root.querySelector('p-avatar')?.getAttribute('aria-hidden')).toBe('true');
  });
});
