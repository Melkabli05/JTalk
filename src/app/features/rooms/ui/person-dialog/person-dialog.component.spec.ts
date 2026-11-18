import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { Person } from '@core/auth/identity.models';
import type { PersonCard } from '@core/people/person-card.model';
import { PersonDialogComponent } from './person-dialog.component';

const MAYA: Person = { id: 'm-1', name: 'Maya', nativeLanguage: 'es', learning: 'ja', avatar: '' };
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

describe('PersonDialogComponent (presentational)', () => {
  let fixture: ComponentFixture<PersonDialogComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent?.replace(/\s+/g, ' ') ?? '';
  const nameOf = (b: Element) => b.getAttribute('aria-label') ?? b.textContent?.trim();
  const buttons = () => [...root().querySelectorAll('button')];
  const labels = () => buttons().map(nameOf);
  const button = (label: string) => buttons().find((b) => nameOf(b) === label)!;
  const press = (label: string) => button(label).click();
  const icon = (label: string) => button(label).querySelector('.p-button-icon')?.className ?? '';

  async function render(inputs: Record<string, unknown>) {
    fixture = TestBed.createComponent(PersonDialogComponent);
    for (const [name, value] of Object.entries({ visible: true, member: MAYA, ...inputs })) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  async function openMenu() {
    press('More actions');
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
  }
  const menuItem = (label: string) =>
    [...document.querySelectorAll<HTMLElement>('.p-menu-item-link')].find((item) =>
      item.textContent?.includes(label),
    )!;

  describe('who they are', () => {
    it('has no title bar: the name is in the card, and it is what names the dialog', async () => {
      await render({ role: 'SPEAKER' });

      expect(root().querySelector('.p-dialog-header')).toBeNull();
      const heading = root().querySelector('h2')!;
      expect(heading.textContent).toBe('Maya');
      expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')).toBe(
        heading.id,
      );
    });

    it('tells their role and the languages they speak and learn, until their profile is known', async () => {
      await render({ role: 'SPEAKER' });

      expect(text()).toContain('Speaker');
      expect(text()).toContain('Speaks Spanish');
      expect(text()).toContain('Learning Japanese');
    });

    it('says so when it is you', async () => {
      await render({ role: 'HOST', isMe: true });

      expect(text()).toContain('Host');
      expect(text()).toContain('You');
    });

    it('closes with its own button', async () => {
      await render({ role: 'LISTENER' });
      const closed = vi.fn();
      fixture.componentInstance.visible.subscribe(closed);

      press('Close');

      expect(closed).toHaveBeenCalledWith(false);
    });
  });

  describe('what you can do without a profile', () => {
    it('offers nothing to someone who may do nothing about them', async () => {
      await render({ role: 'LISTENER' });

      expect(labels().filter((l) => l !== 'Close')).toEqual([]);
    });

    it('offers the host to invite a listener, or move a speaker down, in the same row', async () => {
      await render({ role: 'LISTENER', canInvite: true });
      expect(labels()).toContain('Invite to the stage');
      expect(labels()).not.toContain('Move to the audience');

      await render({ role: 'SPEAKER', canDemote: true });
      expect(labels()).toContain('Move to the audience');
    });

    it('lets a speaker step down from their own seat', async () => {
      const stepped = vi.fn();
      await render({ role: 'SPEAKER', isMe: true, canStepDown: true });
      fixture.componentInstance.stepDown.subscribe(stepped);

      press('Step down to the audience');

      expect(stepped).toHaveBeenCalledOnce();
    });

    it('emits what the host chose', async () => {
      const emitted: string[] = [];
      await render({ role: 'LISTENER', canInvite: true });
      fixture.componentInstance.invite.subscribe(() => emitted.push('invite'));
      press('Invite to the stage');

      await render({ role: 'SPEAKER', canDemote: true });
      fixture.componentInstance.demote.subscribe(() => emitted.push('demote'));
      press('Move to the audience');

      expect(emitted).toEqual(['invite', 'demote']);
    });

    it('keeps the less usual actions in a menu, and runs the one that is chosen', async () => {
      const removed = vi.fn();
      await render({
        role: 'LISTENER',
        actions: [{ label: 'Remove from the room', icon: 'pi pi-user-minus', command: removed }],
      });
      expect(labels()).not.toContain('Remove from the room');

      await openMenu();
      menuItem('Remove from the room').click();

      expect(removed).toHaveBeenCalledOnce();
    });

    it('has no menu button when there is nothing in the menu', async () => {
      await render({ role: 'LISTENER', canInvite: true });

      expect(labels()).not.toContain('More actions');
    });

    it('colours the host actions Sand, and draws them with the right icons', async () => {
      await render({ role: 'LISTENER', canInvite: true });
      expect(button('Invite to the stage').className).toContain('p-button-warn');
      expect(icon('Invite to the stage')).toContain('pi-microphone');

      await render({ role: 'SPEAKER', canDemote: true });
      expect(button('Move to the audience').className).toContain('p-button-warn');
      expect(icon('Move to the audience')).toContain('pi-arrow-down');
    });

    it('draws its actions compact, so they take little room', async () => {
      await render({ role: 'LISTENER', canInvite: true, actions: [{ label: 'Block' }] });

      for (const label of ['Invite to the stage', 'More actions', 'Close']) {
        expect(button(label).classList).toContain('compact');
      }
    });
  });

  describe('with their profile loaded', () => {
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

    it('asks to follow back when they follow you, with one compact Forest button', async () => {
      const followed = vi.fn();
      await render({ role: 'LISTENER', card: CARD });
      fixture.componentInstance.follow.subscribe(followed);

      expect(button('Follow back').classList).toContain('compact');
      for (const other of ['secondary', 'warn', 'danger', 'outlined']) {
        expect(button('Follow back').className).not.toContain(`p-button-${other}`);
      }
      expect(icon('Follow back')).toContain('pi-user-plus');
      press('Follow back');

      expect(followed).toHaveBeenCalledOnce();
    });

    it('shows Following, and unfollows with the same press', async () => {
      const unfollowed = vi.fn();
      await render({
        role: 'LISTENER',
        card: { ...CARD, social: { ...CARD.social!, followedByMe: true } },
      });
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

    it('opens their full profile from the end of the card', async () => {
      const viewed = vi.fn();
      await render({ role: 'LISTENER', card: CARD });
      fixture.componentInstance.viewProfile.subscribe(viewed);

      press('View profile');

      expect(viewed).toHaveBeenCalledOnce();
    });

    it('is only a view for yourself: no follow, and only the actions you were given', async () => {
      await render({ role: 'HOST', isMe: true, card: { ...CARD, isMe: true, match: undefined } });

      expect(labels()).not.toContain('Follow back');
      expect(labels()).not.toContain('More actions');
      expect(labels()).toContain('View profile');
    });

    it('keeps the actions above the details, in one row', async () => {
      await render({
        role: 'LISTENER',
        card: CARD,
        canInvite: true,
        actions: [{ label: 'Block' }],
      });
      const actions = root().querySelector('.actions')!;

      expect([...actions.querySelectorAll('button')].map(nameOf)).toEqual([
        'Follow back',
        'Invite to the stage',
        'More actions',
      ]);
      expect(
        actions.compareDocumentPosition(root().querySelector('.about')!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(root().querySelectorAll('.actions')).toHaveLength(1);
    });

    it('cannot be pressed while a request runs', async () => {
      await render({ role: 'LISTENER', card: CARD, busy: true });

      expect(button('Follow back').disabled).toBe(true);
    });
  });

  describe('while it loads, and when it fails', () => {
    it('shows placeholders while their profile loads, and still offers the host their actions', async () => {
      await render({ role: 'LISTENER', loading: true, canInvite: true });

      expect(root().querySelectorAll('p-skeleton')).toHaveLength(3);
      expect(labels()).toContain('Invite to the stage');
    });

    it('says what went wrong', async () => {
      await render({
        role: 'LISTENER',
        card: CARD,
        error: 'Could not follow them. Please try again.',
      });

      expect(text()).toContain('Could not follow them.');
    });
  });
});
