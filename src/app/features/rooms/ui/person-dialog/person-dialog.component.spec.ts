import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { PersonDialogComponent } from './person-dialog.component';
import type { Person } from '@core/auth/identity.models';

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
});
