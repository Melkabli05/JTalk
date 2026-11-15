import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { RaisedHandsComponent } from './raised-hands.component';
import type { Person } from '@core/auth/identity.models';

const MEMBERS: ReadonlyMap<string, Person> = new Map([
  ['b-1', { id: 'b-1', name: 'Bob', nativeLanguage: 'en', learning: 'ar', avatar: '' }],
  ['c-2', { id: 'c-2', name: 'Carol', nativeLanguage: 'ar', learning: 'en', avatar: '' }],
]);

describe('RaisedHandsComponent (presentational)', () => {
  let fixture: ComponentFixture<RaisedHandsComponent>;
  const root = () => fixture.nativeElement as HTMLElement;

  async function render(canInvite: boolean) {
    fixture = TestBed.createComponent(RaisedHandsComponent);
    fixture.componentRef.setInput('ids', ['b-1', 'c-2']);
    fixture.componentRef.setInput('members', MEMBERS);
    fixture.componentRef.setInput('canInvite', canInvite);
    await fixture.whenStable();
  }

  it('lists the people with a hand up, in order', async () => {
    await render(false);

    expect([...root().querySelectorAll('li .name')].map((n) => n.textContent)).toEqual([
      'Bob',
      'Carol',
    ]);
  });

  it('is a named, numbered list: first to raise a hand is first', async () => {
    await render(false);

    expect(root().querySelector('ol')?.getAttribute('aria-label')).toBe('Raised hands');
    expect([...root().querySelectorAll('.position')].map((p) => p.textContent?.trim())).toEqual([
      '1',
      '2',
    ]);
  });

  it('gives the host an Invite button per person, named for screen readers', async () => {
    await render(true);

    const buttons = [...root().querySelectorAll('button')];
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Invite Bob to the stage',
      'Invite Carol to the stage',
    ]);
  });

  it('asks to invite the right person', async () => {
    await render(true);
    const invited = vi.fn();
    fixture.componentInstance.invited.subscribe(invited);

    root().querySelectorAll('button')[1].click();

    expect(invited).toHaveBeenCalledExactlyOnceWith('c-2');
  });

  it('shows no buttons to anyone but the host', async () => {
    await render(false);

    expect(root().querySelectorAll('button')).toHaveLength(0);
  });
});
