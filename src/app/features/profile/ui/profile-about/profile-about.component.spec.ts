import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { PersonCard } from '@core/people/person-card.model';
import { ProfileAboutComponent } from './profile-about.component';

const CARD: PersonCard = {
  details: {
    id: 'u-2',
    name: 'Nour',
    avatar: '',
    nativeLanguage: 'es',
    learning: 'ar',
    username: 'nour',
    bio: 'Hola! I love tea.',
    countryCode: 'ES',
    joinedAt: '2026-10-01T10:00:00Z',
  },
  social: undefined,
  languages: { native: ['es'], learning: [{ code: 'ar', level: 'INTERMEDIATE' }] },
  match: { kind: 'exchange', theySpeak: 'es', theyLearn: 'ar' },
  isMe: false,
};

describe('ProfileAboutComponent (presentational)', () => {
  let fixture: ComponentFixture<ProfileAboutComponent>;
  const root = () => fixture.nativeElement as HTMLElement;

  async function render(card: PersonCard) {
    fixture = TestBed.createComponent(ProfileAboutComponent);
    fixture.componentRef.setInput('card', card);
    await fixture.whenStable();
  }

  it('tells their bio, the match with you, and their languages with levels', async () => {
    await render(CARD);

    expect(root().querySelector('.bio')?.textContent).toBe('Hola! I love tea.');
    expect([...root().querySelectorAll('h2')].map((h) => h.textContent)).toEqual([
      'About',
      'Languages',
    ]);
    expect(root().textContent).toContain('Language exchange match');
    expect(root().textContent).toContain('Intermediate');
  });

  it('leaves the bio out for someone who wrote none, but nudges you to write yours', async () => {
    await render({ ...CARD, details: { ...CARD.details, bio: '' } });
    expect(root().querySelector('.bio')).toBeNull();
    expect(root().querySelector('.empty')).toBeNull();

    await render({ ...CARD, details: { ...CARD.details, bio: '' }, isMe: true, match: undefined });
    expect(root().querySelector('.empty')?.textContent).toContain('Add a short bio');
  });

  it('has no About card for someone with nothing to say and no match, only their languages', async () => {
    await render({ ...CARD, details: { ...CARD.details, bio: '' }, match: undefined });

    expect([...root().querySelectorAll('h2')].map((h) => h.textContent)).toEqual(['Languages']);
  });
});
