import { TestBed } from '@angular/core/testing';
import { PersonAvatarComponent } from './person-avatar.component';
import type { Person } from '@core/auth/identity.models';

const ADA: Person = {
  id: 'a-1',
  name: 'Ada Lovelace',
  nativeLanguage: 'en',
  learning: 'ar',
  avatar: '',
};

describe('PersonAvatarComponent (presentational)', () => {
  async function render(member: Person) {
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

  it('pops the reaction it is given on the picture as an icon, and shows a new one when it changes', async () => {
    const fixture = TestBed.createComponent(PersonAvatarComponent);
    fixture.componentRef.setInput('member', ADA);
    fixture.componentRef.setInput('reaction', { id: 1, userId: 'a-1', reaction: 'HEART' });
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.reaction .pi-heart-fill')).not.toBeNull();
    expect(root.querySelector('.reaction')?.getAttribute('aria-hidden')).toBe('true');
    const first = root.querySelector('.reaction');

    fixture.componentRef.setInput('reaction', { id: 2, userId: 'a-1', reaction: 'SMILE' });
    await fixture.whenStable();
    expect(root.querySelector('.reaction .pi-face-smile')).not.toBeNull();
    expect(root.querySelector('.reaction')).not.toBe(first);

    fixture.componentRef.setInput('reaction', null);
    await fixture.whenStable();
    expect(root.querySelector('.reaction')).toBeNull();
  });
});
