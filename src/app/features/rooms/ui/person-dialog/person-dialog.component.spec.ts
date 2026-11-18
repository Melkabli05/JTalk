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
  const icon = (label: string) => button(label).querySelector('.p-button-icon, i')?.className ?? '';

  async function render(inputs: Record<string, unknown>) {
    fixture = TestBed.createComponent(PersonDialogComponent);
    for (const [name, value] of Object.entries({ visible: true, member: MAYA, ...inputs })) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  const strip = () => root().querySelector('.strip')!;

  describe('who they are', () => {
    it('has no title bar: the name is in the card, and it is what names the dialog', async () => {
      await render({ role: 'SPEAKER' });

      expect(root().querySelector('.p-dialog-header')).toBeNull();
      const heading = root().querySelector('h2')!;
      expect(heading.textContent).toBe('Maya');
      expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')).toBe(
        heading.id,
      );
      expect(root().querySelector('[role="dialog"]')?.classList.contains('person-card')).toBe(true);
    });

    it('says in a strip on top where they are, with the close button at its end', async () => {
      const pass = () => strip().querySelector('.pass')?.textContent?.replace(/\s+/g, ' ').trim();
      await render({ role: 'SPEAKER' });
      expect(pass()).toBe('Speaker · On mic');
      expect(strip().querySelector('button')?.getAttribute('aria-label')).toBe('Close');

      await render({ role: 'LISTENER' });
      expect(pass()).toBe('Listener · In the audience');

      await render({ role: 'HOST', isMe: true });
      expect(pass()).toBe('Host · On mic · You');
    });

    it('says what their microphone is doing in words and in a badge, for someone on the stage only', async () => {
      const pass = () => strip().querySelector('.pass')?.textContent ?? '';
      await render({ role: 'SPEAKER' });
      expect(root().querySelector('.portrait .mic')).not.toBeNull();
      expect(root().querySelector('.portrait .mic.off')).toBeNull();

      await render({ role: 'SPEAKER', speaking: true });
      expect(pass()).toContain('Speaking');
      expect(strip().querySelector('.dot')?.classList.contains('live')).toBe(true);
      expect(root().querySelector('app-person-avatar')?.classList.contains('speaking')).toBe(true);

      await render({ role: 'SPEAKER', muted: true });
      expect(pass()).toContain('Muted');
      expect(root().querySelector('.portrait .mic.off')).not.toBeNull();

      await render({ role: 'LISTENER' });
      expect(root().querySelector('.portrait .mic')).toBeNull();
      expect(strip().querySelector('.dot')?.classList.contains('live')).toBe(false);
    });

    it('stacks nothing under the name: the state is in the strip and on the picture', async () => {
      await render({ role: 'SPEAKER', card: CARD });

      expect(root().querySelector('.who p-tag')).toBeNull();
    });

    it('tells the languages they speak and learn, until their profile is known', async () => {
      await render({ role: 'SPEAKER' });

      expect(text()).toContain('Speaks Spanish');
      expect(text()).toContain('Learning Japanese');
    });

    it('says so when it is you', async () => {
      await render({ role: 'HOST', isMe: true });

      expect(strip().textContent).toContain('You');
      expect(text()).toContain('Host');
    });

    it('closes with its own button', async () => {
      await render({ role: 'LISTENER' });
      const closed = vi.fn();
      fixture.componentInstance.visible.subscribe(closed);

      press('Close');

      expect(closed).toHaveBeenCalledWith(false);
    });
  });

  describe('what the host can do, as tiles', () => {
    const tiles = () => [...root().querySelectorAll('.tiles button')].map(nameOf);

    it('offers nothing to someone who may do nothing about them', async () => {
      await render({ role: 'LISTENER' });

      expect(root().querySelector('.tiles')).toBeNull();
    });

    it('offers to invite a listener, or move a speaker down or mute them', async () => {
      await render({ role: 'LISTENER', canInvite: true });
      expect(tiles()).toEqual(['Invite to the stage']);

      await render({ role: 'SPEAKER', canDemote: true, canMute: true });
      expect(tiles()).toEqual(['Mute', 'Move to the audience']);
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

      await render({ role: 'SPEAKER', canDemote: true, canMute: true });
      fixture.componentInstance.demote.subscribe(() => emitted.push('demote'));
      fixture.componentInstance.mute.subscribe(() => emitted.push('mute'));
      press('Move to the audience');
      press('Mute');

      expect(emitted).toEqual(['invite', 'demote', 'mute']);
    });

    it('shows a muted speaker as muted, and cannot mute them again', async () => {
      await render({ role: 'SPEAKER', canMute: true, muted: true });

      expect(button('Muted').disabled).toBe(true);
    });

    it('draws each as a button of the system, the picture above its name: Sand for the host powers, neutral for the rest', async () => {
      await render({ role: 'SPEAKER', canMute: true, canDemote: true, canInvite: true });

      const invite = button('Invite to the stage');
      expect(invite.className).toContain('p-button-warn');
      expect(invite.className).toContain('p-button-outlined');
      expect(invite.querySelector('.p-button-icon')?.className).toContain('p-button-icon-top');
      expect(invite.querySelector('.p-button-icon')?.className).toContain('pi-microphone');
      expect(invite.textContent?.trim()).toBe('To the stage');
      expect(button('Mute').className).toContain('p-button-warn');
      expect(button('Move to the audience').className).toContain('p-button-secondary');
      expect(button('Move to the audience').className).not.toContain('p-button-warn');
    });
  });

  describe('with their profile loaded', () => {
    it('tells who they are: handle, country, bio, when they joined, and what they speak and learn in one line', async () => {
      await render({ role: 'LISTENER', card: CARD });

      expect(text()).toContain('@maya');
      expect(text()).toContain('Spain');
      expect(text()).toContain('Coffee and Japanese');
      expect(text()).toContain('Joined October 2026');
      expect(text()).toContain('1.3K');
      expect(text()).toContain('Follows you');
      expect(root().querySelector('.languages')?.textContent?.replace(/\s+/g, ' ')).toContain(
        'Spanish (Native) 🇯🇵 Japanese (Beginner)',
      );
    });

    it('keeps the numbers and the languages together in one box', async () => {
      await render({ role: 'LISTENER', card: CARD });
      const facts = root().querySelector('.facts')!;

      expect(facts.querySelector('app-social-stats')).not.toBeNull();
      expect(facts.querySelector('.languages')).not.toBeNull();
    });

    it('says how they could help you practise', async () => {
      await render({ role: 'LISTENER', card: CARD });

      expect(text()).toContain('Can help you practise');
    });

    it('asks to follow back when they follow you, with one full-width Forest button', async () => {
      const followed = vi.fn();
      await render({ role: 'LISTENER', card: CARD });
      fixture.componentInstance.follow.subscribe(followed);

      expect(root().querySelector('app-follow-button')?.classList).toContain('block');
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

    it('opens their full profile from the strip on top, next to the close button', async () => {
      const viewed = vi.fn();
      await render({ role: 'LISTENER', card: CARD });
      fixture.componentInstance.viewProfile.subscribe(viewed);

      expect([...strip().querySelectorAll('button')].map(nameOf)).toEqual([
        'View profile',
        'Close',
      ]);
      press('View profile');

      expect(viewed).toHaveBeenCalledOnce();
    });

    it('says when they joined beside their handle at the top, and has no footer', async () => {
      await render({ role: 'LISTENER', card: CARD });

      expect(root().querySelector('.handle')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        '@maya Joined October 2026',
      );
      expect(root().querySelector('.foot')).toBeNull();
    });

    it('offers no profile link before their profile is known', async () => {
      await render({ role: 'LISTENER' });

      expect(labels()).not.toContain('View profile');
    });

    it('is only a view for yourself: no follow, nothing to block', async () => {
      await render({ role: 'HOST', isMe: true, card: { ...CARD, isMe: true, match: undefined } });

      expect(labels()).not.toContain('Follow back');
      expect(root().querySelector('.safety')).toBeNull();
      expect(labels()).toContain('View profile');
    });

    it('keeps the follow button and the tiles above the details', async () => {
      await render({ role: 'LISTENER', card: CARD, canInvite: true });
      const follow = root().querySelector('.follow')!;
      const tiles = root().querySelector('.tiles')!;
      const facts = root().querySelector('.facts')!;

      const before = (a: Element, b: Element) =>
        Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      expect(before(follow, tiles)).toBe(true);
      expect(before(tiles, facts)).toBe(true);
    });

    it('cannot be pressed while a request runs', async () => {
      await render({ role: 'LISTENER', card: CARD, busy: true });

      expect(button('Follow back').disabled).toBe(true);
    });
  });

  describe('safety', () => {
    const header = () => root().querySelector<HTMLElement>('.safety .p-accordionheader')!;
    const open = async () => {
      header().click();
      await fixture.whenStable();
    };

    it('keeps blocking in a section that is closed until it is opened, and asks nothing until it is pressed', async () => {
      const blocked = vi.fn();
      await render({ role: 'LISTENER', card: CARD, canBlock: true });
      fixture.componentInstance.block.subscribe(blocked);
      expect(header().textContent).toContain('Safety');
      expect(header().getAttribute('aria-expanded')).toBe('false');

      await open();
      expect(header().getAttribute('aria-expanded')).toBe('true');
      press('Block');

      expect(blocked).toHaveBeenCalledOnce();
    });

    it('is called moderation and safety for the host, who can also remove them from the room', async () => {
      const removed = vi.fn();
      await render({ role: 'LISTENER', card: CARD, canBlock: true, canRemove: true });
      fixture.componentInstance.remove.subscribe(removed);

      expect(header().textContent).toContain('Moderation and safety');
      expect(button('Remove from the room').className).toContain('p-button-danger');
      press('Remove from the room');

      expect(removed).toHaveBeenCalledOnce();
    });

    it('has neither when there is nothing to do about them', async () => {
      await render({ role: 'LISTENER', card: CARD });

      expect(root().querySelector('.safety')).toBeNull();
      expect(labels()).not.toContain('Remove from the room');
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
