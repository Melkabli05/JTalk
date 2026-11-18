import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { Person } from '@core/auth/identity.models';
import type { PersonDetails } from '@core/people/person-card.model';
import { ProfileHeroComponent } from './profile-hero.component';

const MONA: Person = {
  id: 'm-1',
  name: 'Mona Hassan',
  nativeLanguage: 'ar',
  learning: 'en',
  avatar: 'avatar-06',
};

describe('ProfileHeroComponent (presentational)', () => {
  let fixture: ComponentFixture<ProfileHeroComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent?.replace(/\s+/g, ' ') ?? '';

  async function render(person: Person) {
    fixture = TestBed.createComponent(ProfileHeroComponent);
    fixture.componentRef.setInput('person', person);
    await fixture.whenStable();
  }

  it('shows the name as the heading, with the picture and both languages', async () => {
    await render(MONA);

    expect(root().querySelector('h1')?.textContent).toBe('Mona Hassan');
    expect(root().querySelector('img')?.getAttribute('src')).toBe('avatars/avatar-06.svg');
    expect(text()).toContain('Speaks Arabic');
    expect(text()).toContain('Learning English');
  });

  it('falls back to initials when there is no picture', async () => {
    await render({ ...MONA, avatar: '' });

    expect(root().querySelector('img')).toBeNull();
    expect(text()).toContain('MH');
  });

  it('leaves out the language being learned when it is not known', async () => {
    await render({ ...MONA, learning: '' });

    expect(text()).toContain('Speaks Arabic');
    expect(text()).not.toContain('Learning');
  });

  it('adds the handle, the country and when they joined once their profile is known', async () => {
    fixture = TestBed.createComponent(ProfileHeroComponent);
    const details: PersonDetails = {
      ...MONA,
      username: 'mona_x',
      bio: '',
      countryCode: 'MA',
      joinedAt: '2026-11-01T10:00:00Z',
    };
    fixture.componentRef.setInput('person', MONA);
    fixture.componentRef.setInput('details', details);
    await fixture.whenStable();

    expect(text()).toContain('@mona_x');
    expect(text()).toContain('Morocco');
    expect(text()).toContain('Joined November 2026');
  });

  it('has no meta line before the profile is known', async () => {
    await render(MONA);

    expect(root().querySelector('.meta')).toBeNull();
  });
});
