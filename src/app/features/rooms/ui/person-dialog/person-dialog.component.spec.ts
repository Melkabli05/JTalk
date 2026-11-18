import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { PersonDialogComponent } from './person-dialog.component';
import type { Person } from '@core/auth/identity.models';
import type { PersonCard } from '@core/people/person-card.model';

const MAYA: Person = { id: 'm-1', name: 'Maya', nativeLanguage: 'es', learning: 'ja', avatar: '' };

describe('PersonDialogComponent (presentational)', () => {
  let fixture: ComponentFixture<PersonDialogComponent>;
  const text = () => (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
  const labels = () =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].map((b) =>
      b.textContent?.trim(),
    );

  async function render(inputs: Record<string, unknown>) {
    fixture = TestBed.createComponent(PersonDialogComponent);
    for (const [name, value] of Object.entries({ visible: true, member: MAYA, ...inputs })) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  it('tells who the person is: their role and the languages they speak and learn', async () => {
    await render({ role: 'SPEAKER' });

    expect(text()).toContain('Speaker');
    expect(text()).toContain('Speaks');
    expect(text()).toContain('Spanish');
    expect(text()).toContain('Learning');
    expect(text()).toContain('Japanese');
  });

  it('says so when it is you', async () => {
    await render({ role: 'HOST', isMe: true });

    expect(text()).toContain('Host');
    expect(text()).toContain('You');
  });

  it('offers nothing to someone who may do nothing about them', async () => {
    await render({ role: 'LISTENER' });

    expect(labels().filter((l) => l && !l.includes('Close'))).toEqual([]);
  });

  it('offers the host the right actions for a listener', async () => {
    await render({ role: 'LISTENER', canInvite: true, canRemove: true });

    expect(labels()).toEqual(
      expect.arrayContaining(['Invite to the stage', 'Remove from the room']),
    );
    expect(labels()).not.toContain('Move to the audience');
  });

  it('emits the action that was chosen', async () => {
    await render({ role: 'SPEAKER', canDemote: true, canRemove: true });
    const emitted: string[] = [];
    fixture.componentInstance.demote.subscribe(() => emitted.push('demote'));
    fixture.componentInstance.remove.subscribe(() => emitted.push('remove'));
    const click = (label: string) =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')]
        .find((b) => b.textContent?.includes(label))!
        .click();

    click('Move to the audience');
    click('Remove from the room');

    expect(emitted).toEqual(['demote', 'remove']);
  });

  it('lets someone on stage step down themselves', async () => {
    await render({ role: 'SPEAKER', isMe: true, canStepDown: true });

    expect(labels()).toContain('Step down to the audience');
  });

  describe('with their profile loaded', () => {
    const CARD: PersonCard = {
      details: {
        ...MAYA,
        username: 'maya',
        bio: 'Coffee and Japanese',
        countryCode: 'ES',
        joinedAt: '2026-10-01T10:00:00Z',
      },
      social: { followers: 1250, following: 3, followedByMe: false, followsMe: true },
      languages: { native: ['es'], learning: [{ code: 'ja', level: 'BEGINNER' }] },
      match: { kind: 'teaches-you', theySpeak: 'es' },
      isMe: false,
    };
    const press = (label: string) =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')]
        .find((b) => b.textContent?.trim() === label)!
        .click();

    it('tells who they are: handle, country, bio, how long they have been here, and what they speak and learn', async () => {
      await render({ role: 'LISTENER', card: CARD });

      expect(text()).toContain('@maya');
      expect(text()).toContain('Spain');
      expect(text()).toContain('Coffee and Japanese');
      expect(text()).toContain('Joined October 2026');
      expect(text()).toContain('Beginner');
      expect(text()).toContain('1.3K');
      expect(text()).toContain('Follows you');
    });

    it('says how they could help you practise', async () => {
      await render({ role: 'LISTENER', card: CARD });

      expect(text()).toContain('Can help you practise');
    });

    it('asks to follow back when they follow you, and follows with one press', async () => {
      const followed = vi.fn();
      await render({ role: 'LISTENER', card: CARD });
      fixture.componentInstance.follow.subscribe(followed);

      press('Follow back');

      expect(followed).toHaveBeenCalledOnce();
    });

    it('shows Following, and unfollows with the same press', async () => {
      const unfollowed = vi.fn();
      const following = { ...CARD, social: { ...CARD.social!, followedByMe: true } };
      await render({ role: 'LISTENER', card: following });
      fixture.componentInstance.unfollow.subscribe(unfollowed);

      press('Following');

      expect(unfollowed).toHaveBeenCalledOnce();
    });

    it('does not offer to follow before it knows whether you already do', async () => {
      await render({ role: 'LISTENER', card: { ...CARD, social: undefined } });

      expect(labels()).not.toContain('Follow back');
      expect(labels()).not.toContain('Following');
      expect(labels()).toContain('View profile');
    });

    it('opens their profile, and can block them', async () => {
      const emitted: string[] = [];
      await render({ role: 'LISTENER', card: CARD });
      fixture.componentInstance.viewProfile.subscribe(() => emitted.push('profile'));
      fixture.componentInstance.block.subscribe(() => emitted.push('block'));

      press('View profile');
      press('Block');

      expect(emitted).toEqual(['profile', 'block']);
    });

    it('is only a view for yourself: no follow, no block', async () => {
      await render({ role: 'HOST', isMe: true, card: { ...CARD, isMe: true, match: undefined } });

      expect(labels()).not.toContain('Follow back');
      expect(labels()).not.toContain('Block');
      expect(labels()).toContain('View profile');
    });

    it('keeps the host actions apart from the social ones', async () => {
      await render({ role: 'LISTENER', card: CARD, canInvite: true, canRemove: true });

      expect(labels()).toEqual(
        expect.arrayContaining(['Follow back', 'Invite to the stage', 'Remove from the room']),
      );
    });

    it('shows placeholders while their profile loads, and says when something failed', async () => {
      await render({ role: 'LISTENER', loading: true });
      expect((fixture.nativeElement as HTMLElement).querySelectorAll('p-skeleton')).toHaveLength(3);

      fixture.componentRef.setInput('loading', false);
      fixture.componentRef.setInput('error', 'Could not follow them. Please try again.');
      await fixture.whenStable();
      expect(text()).toContain('Could not follow them.');
    });

    it('cannot be pressed while a request runs', async () => {
      await render({ role: 'LISTENER', card: CARD, busy: true });

      const follow = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Follow back',
      );
      expect(follow?.disabled).toBe(true);
    });
  });
});
