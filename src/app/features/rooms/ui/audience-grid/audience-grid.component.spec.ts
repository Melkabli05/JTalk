import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { AudienceGridComponent } from './audience-grid.component';
import type { Person } from '@core/auth/identity.models';

const MEMBERS: ReadonlyMap<string, Person> = new Map([
  ['a-1', { id: 'a-1', name: 'Ada', nativeLanguage: 'en', learning: 'ar', avatar: '' }],
  ['b-2', { id: 'b-2', name: 'Bob', nativeLanguage: 'ar', learning: 'en', avatar: '' }],
]);

describe('AudienceGridComponent (presentational)', () => {
  let fixture: ComponentFixture<AudienceGridComponent>;
  const root = () => fixture.nativeElement as HTMLElement;

  async function render(inputs: Record<string, unknown> = {}) {
    fixture = TestBed.createComponent(AudienceGridComponent);
    for (const [name, value] of Object.entries({
      ids: ['a-1', 'b-2'],
      members: MEMBERS,
      meId: 'a-1',
      ...inputs,
    })) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  it('names each person and their role for screen readers, and says which one is you', async () => {
    await render();

    expect(
      [...root().querySelectorAll('.person')].map((p) => p.getAttribute('aria-label')),
    ).toEqual(['Ada (you), Listener', 'Bob, Listener']);
  });

  it('gives the host a menu only on the people it has actions for', async () => {
    await render({ moderation: new Map([['b-2', [{ label: 'Remove from the room' }]]]) });
    const bob = root().querySelectorAll<HTMLElement>('.person')[1];

    root()
      .querySelectorAll<HTMLElement>('.person')[0]
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.querySelectorAll('.p-menu-item-link')).toHaveLength(0);

    bob.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    expect(
      [...document.querySelectorAll('.p-menu-item-link')].map((link) => link.textContent?.trim()),
    ).toEqual(['Remove from the room']);
  });

  it('opens the person who was picked', async () => {
    await render();
    const selected = vi.fn();
    fixture.componentInstance.memberSelected.subscribe(selected);

    root().querySelectorAll<HTMLButtonElement>('.person')[1].click();

    expect(selected).toHaveBeenCalledExactlyOnceWith('b-2');
  });

  it('says in words, not only by dimming, that someone is reconnecting', async () => {
    await render({ reconnecting: ['b-2'] });

    expect(root().querySelectorAll('.person')[1].textContent).toContain('Reconnecting');
    expect(root().querySelectorAll('.person')[0].textContent).not.toContain('Reconnecting');
  });

  it('says so when nobody is listening', async () => {
    await render({ ids: [] });

    expect(root().textContent).toContain('Nobody is listening yet.');
  });

  it('is a named list', async () => {
    await render();

    expect(root().querySelector('ul')?.getAttribute('aria-label')).toBe('In the audience');
  });

  it('shows a reaction on the face of the person who sent it, and only theirs', async () => {
    await render({ reactions: new Map([['b-2', { id: 1, userId: 'b-2', reaction: 'SPARKLES' }]]) });

    const [ada, bob] = [...root().querySelectorAll('li')];
    expect(ada?.querySelector('.reaction')).toBeNull();
    expect(bob?.querySelector('img.reaction[src$="sparkles.svg"]')).not.toBeNull();
  });
});
